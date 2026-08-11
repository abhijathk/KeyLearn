import { test } from "node:test";
import { type Result, ResultFaker } from "@keylearn/result";
import { deepEqual, equal, rejects } from "rich-assert";
import { FakeLocalResultStorage, FakeRemoteResultSync } from "../fake/index.ts";
import {
  ResultStorageOfAnonymousUser,
  ResultStorageOfNamedUser,
  ResultStorageOfPublicUser,
  wrapResultStorage,
} from "./storage.ts";
import { type LocalResultStorage, type RemoteResultSync } from "./types.ts";

const faker = new ResultFaker();

test("named user - initially is empty", async () => {
  const local: Result[] = [];
  const remote: Result[] = [];

  const storage = wrapResultStorage(
    new ResultStorageOfNamedUser(
      new FakeLocalResultStorage(local),
      new FakeRemoteResultSync(remote),
    ),
  );

  const results = await storage.load();

  equal(local.length, 0);
  equal(remote.length, 0);
  equal(results.length, 0);
});

test("named user - local data is carried up, not ignored", async () => {
  const r0 = faker.nextResult();
  const r1 = faker.nextResult();
  const r2 = faker.nextResult();
  const r3 = faker.nextResult();
  const local: Result[] = [r0, r1];
  const remote: Result[] = [r2, r3];

  const storage = wrapResultStorage(
    new ResultStorageOfNamedUser(
      new FakeLocalResultStorage(local),
      new FakeRemoteResultSync(remote),
    ),
  );

  const results = await storage.load();

  // This used to assert the opposite — that local data was ignored and left on
  // the device. For a signed-in learner that is silent data loss: results they
  // typed while offline stayed invisible and were never uploaded.
  deepEqual(results, [r2, r3, r0, r1]);

  // Handed over, so the device no longer has to hold them.
  deepEqual(local, []);

  deepEqual(remote, [r2, r3, r0, r1]);
});

test("named user - upload local to remote on first sync", async () => {
  const r0 = faker.nextResult();
  const r1 = faker.nextResult();
  const local: Result[] = [r0, r1];
  const remote: Result[] = [];

  const storage = wrapResultStorage(
    new ResultStorageOfNamedUser(
      new FakeLocalResultStorage(local),
      new FakeRemoteResultSync(remote),
    ),
  );

  const results = await storage.load();

  // Should contain data from updated remote store.
  deepEqual(results, [r0, r1]);

  // Local store should be cleared.
  deepEqual(local, []);

  // Remote store should be updated.
  deepEqual(remote, [r0, r1]);
});

test("anonymous user - append to local", async () => {
  const r0 = faker.nextResult();
  const r1 = faker.nextResult();
  const r2 = faker.nextResult({ length: 0, time: 0 });
  const local: Result[] = [];

  const storage = wrapResultStorage(
    new ResultStorageOfAnonymousUser(new FakeLocalResultStorage(local)),
  );

  await storage.append([r0]);
  await storage.append([r1]);
  await storage.append([r2]);
  const results = await storage.load();

  // Should contain data from updated local store.
  deepEqual(results, [r0, r1]);

  // Local store should be updated.
  deepEqual(local, [r0, r1]);
});

test("named user - append to remote", async () => {
  const r0 = faker.nextResult();
  const r1 = faker.nextResult();
  const r2 = faker.nextResult({ length: 0, time: 0 });
  const local: Result[] = [];
  const remote: Result[] = [];

  const storage = wrapResultStorage(
    new ResultStorageOfNamedUser(
      new FakeLocalResultStorage(local),
      new FakeRemoteResultSync(remote),
    ),
  );

  await storage.append([r0]);
  await storage.append([r1]);
  await storage.append([r2]);
  const results = await storage.load();

  // Should contain data from updated remote store.
  deepEqual(results, [r0, r1]);

  // Local store should stay empty.
  deepEqual(local, []);

  // Remote store should be updated.
  deepEqual(remote, [r0, r1]);
});

test("public user - is readonly", async () => {
  const r0 = faker.nextResult();
  const r1 = faker.nextResult();
  const r2 = faker.nextResult({ length: 0, time: 0 });
  const remote: Result[] = [r0, r1, r2];

  const storage = wrapResultStorage(
    new ResultStorageOfPublicUser(new FakeRemoteResultSync(remote)),
  );

  const results = await storage.load();

  deepEqual(results, [r0, r1]);

  // Try to append.
  await rejects(
    storage.append([faker.nextResult()]),
    /Cannot add records to database/,
  );

  // Try to clear.
  await rejects(storage.clear(), /Cannot clear database/);
});

test("handle local storage errors", async () => {
  const storage = wrapResultStorage(
    new ResultStorageOfAnonymousUser(
      new (class FailingLocalResultStorage implements LocalResultStorage {
        async load(): Promise<Result[]> {
          throw new Error("Test read error");
        }

        async append(): Promise<void> {
          throw new Error("Test add error");
        }

        async clear(): Promise<void> {
          throw new Error("Test clear error");
        }
      })(),
    ),
  );

  // Try to open.
  await rejects(storage.load(), /Cannot read records from database/);

  // Try to append.
  await rejects(
    storage.append([faker.nextResult()]),
    /Cannot add records to database/,
  );

  // Try to clear.
  await rejects(storage.clear(), /Cannot clear database/);
});

test("handle remote sync errors", async () => {
  const storage = wrapResultStorage(
    new ResultStorageOfNamedUser(
      new FakeLocalResultStorage([]),
      new (class FailingRemoteResultSync implements RemoteResultSync {
        async receive(): Promise<Result[]> {
          throw new Error("Test receive error");
        }

        async send(): Promise<void> {
          throw new Error("Test send error");
        }

        async clear(): Promise<void> {
          throw new Error("Test clear error");
        }
      })(),
    ),
  );

  // Try to open.
  await rejects(storage.load(), /Cannot read records from database/);

  // Appending no longer rejects when only the SERVER is unreachable. The
  // result is on the device and goes up on the next connection, so failing
  // here would report a loss that has not happened. A failure of the LOCAL
  // write still rejects — that is the case where something really is gone,
  // and "handle local storage errors" below covers it.
  await storage.append([faker.nextResult()]);

  // Try to clear.
  await rejects(storage.clear(), /Cannot clear database/);
});

// A remote that is simply not there, the way it is on a train.
class OfflineRemoteSync implements RemoteResultSync {
  online = false;
  readonly sent: Result[] = [];

  async send(results: readonly Result[]): Promise<void> {
    if (!this.online) {
      throw new Error("offline");
    }
    this.sent.push(...results);
  }

  async receive(): Promise<Result[]> {
    if (!this.online) {
      throw new Error("offline");
    }
    return [...this.sent];
  }

  async clear(): Promise<void> {
    this.sent.length = 0;
  }
}

// This used to send straight to the server and nowhere else, so a lesson
// finished without a connection was not written anywhere at all.
test("named user - a lesson finished offline is not lost", async () => {
  const faker = new ResultFaker();
  const r0 = faker.nextResult();
  const local: Result[] = [];
  const remote = new OfflineRemoteSync();
  const storage = new ResultStorageOfNamedUser(
    new FakeLocalResultStorage(local),
    remote,
  );

  await storage.append([r0]);

  // Nowhere to send it, so it is on the device rather than gone.
  deepEqual(local, [r0]);
  equal(remote.sent.length, 0);
});

test("named user - what was typed offline goes up on the next append", async () => {
  const faker = new ResultFaker();
  const r0 = faker.nextResult();
  const r1 = faker.nextResult();
  const local: Result[] = [];
  const remote = new OfflineRemoteSync();
  const storage = new ResultStorageOfNamedUser(
    new FakeLocalResultStorage(local),
    remote,
  );

  await storage.append([r0]);
  remote.online = true;
  await storage.append([r1]);

  deepEqual(remote.sent, [r0, r1]);
  deepEqual(local, []);
});

test("named user - and on the next load", async () => {
  const faker = new ResultFaker();
  const r0 = faker.nextResult();
  const local: Result[] = [];
  const remote = new OfflineRemoteSync();
  const storage = new ResultStorageOfNamedUser(
    new FakeLocalResultStorage(local),
    remote,
  );

  await storage.append([r0]);
  remote.online = true;

  deepEqual(await storage.load(), [r0]);
  deepEqual(local, []);
});

// Their own history is on the device; showing it beats showing an empty page
// to somebody who has been practising all week.
test("named user - offline, their history still loads", async () => {
  const faker = new ResultFaker();
  const r0 = faker.nextResult();
  const local: Result[] = [r0];
  const remote = new OfflineRemoteSync();
  const storage = new ResultStorageOfNamedUser(
    new FakeLocalResultStorage(local),
    remote,
  );

  deepEqual(await storage.load(), [r0]);
});

test("named user - a local store that will not write still reaches the server", async () => {
  // The device's own database can be broken in ways nobody can see: a store
  // that was never created, a quota that is full, a private window that
  // refuses persistence. Buffering locally before uploading is there to
  // survive being offline — it must not become a way to lose a lesson that
  // the server was perfectly willing to take.
  const r0 = faker.nextResult();
  const remote: Result[] = [];
  const broken: LocalResultStorage = {
    async load() {
      throw new Error("no object store");
    },
    async append() {
      throw new Error("no object store");
    },
    async clear() {},
  };

  const storage = wrapResultStorage(
    new ResultStorageOfNamedUser(broken, new FakeRemoteResultSync(remote)),
  );

  await storage.append([r0]);

  deepEqual(remote, [r0]);
});

test("named user - a lesson is lost only when both ends refuse it", async () => {
  // And when that happens the caller is told, rather than watching a result
  // count on screen that nothing anywhere is holding.
  const r0 = faker.nextResult();
  const broken: LocalResultStorage = {
    async load() {
      throw new Error("no object store");
    },
    async append() {
      throw new Error("no object store");
    },
    async clear() {},
  };
  const offline: RemoteResultSync = {
    async receive() {
      throw new Error("offline");
    },
    async send() {
      throw new Error("offline");
    },
    async clear() {},
  };

  const storage = wrapResultStorage(
    new ResultStorageOfNamedUser(broken, offline),
  );

  await rejects(async () => {
    await storage.append([r0]);
  });
});

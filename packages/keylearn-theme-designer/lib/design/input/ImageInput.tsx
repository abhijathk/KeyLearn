import { type Asset, DataUrlAsset } from "@keylearn/themes";
import { useDocumentEvent } from "@keylearn/widget";
import { useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { acceptImageTypes, acceptsImageType } from "../../io/images.ts";
import * as styles from "./ImageInput.module.less";

export function ImageInput({
  asset,
  onChange,
}: {
  readonly asset: Asset | null;
  readonly onChange: (asset: Asset) => void;
}) {
  const { formatMessage } = useIntl();
  const inputRef = useRef<HTMLInputElement>(null);

  const changeFile = (blob: Blob) => {
    if (blob.size > 0 && acceptsImageType(blob.type)) {
      onChange(new DataUrlAsset(blob));
    }
  };

  useDocumentEvent("paste", (ev) => {
    const files = ev.clipboardData?.files;
    if (files != null && files.length > 0) {
      ev.preventDefault();
      changeFile(files[0]);
    }
  });

  return (
    <div
      className={styles.root}
      onDragOver={(ev) => {
        ev.preventDefault();
      }}
      onDrop={(ev) => {
        ev.preventDefault();
        const files = ev.dataTransfer.files;
        if (files != null && files.length > 0) {
          changeFile(files[0]);
        }
      }}
    >
      {asset && (
        <img
          className={styles.preview}
          src={asset.url}
          alt={formatMessage({
            id: "designer.preview",
            defaultMessage: "Preview",
          })}
        />
      )}
      <input
        ref={inputRef}
        id={styles.inputId}
        className={styles.input}
        type="file"
        accept={acceptImageTypes}
        onChange={() => {
          const el = inputRef.current!;
          const files = el.files;
          if (files != null && files.length > 0) {
            changeFile(files[0]);
          }
        }}
      />
      <label className={styles.label} htmlFor={styles.inputId}>
        <FormattedMessage
          id="designer.select-drop-or-paste-a-file"
          defaultMessage="Select, drop or paste a file…"
        />
      </label>
    </div>
  );
}

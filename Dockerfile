FROM node:24

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the repository files into the container. See .dockerignore — secrets and
# host build artefacts are excluded, because anything copied in here persists in
# an image layer even if a later step deletes it.
COPY . .

# Install dependencies
RUN npm ci

# Compile monorepo and build bundle
RUN npm run compile && npm run build

# Drop privileges. The node images ship an unprivileged `node` user; running the
# server as root means a process compromise starts as root inside the container.
# Own the app directory and the default data dir so both stay writable.
RUN mkdir -p /home/node/.local/state/keybr \
  && chown -R node:node /usr/src/app /home/node/.local
USER node

# Expose the application's default port
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start-docker"]

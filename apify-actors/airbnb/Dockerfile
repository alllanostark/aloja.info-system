FROM apify/actor-node:20
COPY --chown=myuser:myuser package*.json ./
# instala devDeps (TypeScript) e compila no próprio container — evita depender
# do dist/ enviado, que o .gitignore exclui do tarball do apify push.
RUN npm --quiet set progress=false && npm install --omit=optional
COPY --chown=myuser:myuser . ./
RUN npm run build
CMD ["npm", "start", "--silent"]

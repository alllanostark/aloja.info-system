FROM apify/actor-node:20
COPY --chown=myuser:myuser package*.json ./
RUN npm --quiet set progress=false && npm install --omit=optional
COPY --chown=myuser:myuser . ./
RUN npm run build
CMD ["npm", "start", "--silent"]

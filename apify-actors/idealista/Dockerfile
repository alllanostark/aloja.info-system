FROM apify/actor-node-playwright-chrome:20

# CAMADA 1 — rebrowser-playwright: desativa o leak CDP Runtime.enable que o
# DataDome usa como sinal primário de automação. O modo addBinding injeta a
# função sem acionar o evento Runtime.enable que expõe o CDP ao site.
ENV REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding

COPY --chown=myuser:myuser package*.json ./
RUN npm --quiet set progress=false && npm install --omit=dev --omit=optional
COPY --chown=myuser:myuser . ./
CMD ["npm", "start", "--silent"]

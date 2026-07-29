FROM node:20-alpine AS build
WORKDIR /app

# Railway rellena automáticamente estos ARG con las Variables del servicio que tengan el mismo
# nombre — pero solo si están declaradas acá. Sin esto, `docker build` corre aislado del panel de
# Variables y Vite nunca ve VITE_MOCK_*/VITE_SHOW_ACCESO_RAPIDO, sin importar cuántas veces se
# redespliegue (el bundle sale idéntico porque nada en el build context cambió).
ARG VITE_MOCK_AUTH
ARG VITE_MOCK_SECTORES
ARG VITE_MOCK_PLANTILLAS
ARG VITE_MOCK_ARCHIVOS_EXCEL
ARG VITE_MOCK_EJEMPLOS
ARG VITE_MOCK_USUARIOS
ARG VITE_MOCK_MENTORIAS
ARG VITE_MOCK_FACTURACION
ARG VITE_MOCK_HISTORIAL
ARG VITE_MOCK_ACTIVIDAD
ARG VITE_SHOW_ACCESO_RAPIDO
ENV VITE_MOCK_AUTH=$VITE_MOCK_AUTH \
    VITE_MOCK_SECTORES=$VITE_MOCK_SECTORES \
    VITE_MOCK_PLANTILLAS=$VITE_MOCK_PLANTILLAS \
    VITE_MOCK_ARCHIVOS_EXCEL=$VITE_MOCK_ARCHIVOS_EXCEL \
    VITE_MOCK_EJEMPLOS=$VITE_MOCK_EJEMPLOS \
    VITE_MOCK_USUARIOS=$VITE_MOCK_USUARIOS \
    VITE_MOCK_MENTORIAS=$VITE_MOCK_MENTORIAS \
    VITE_MOCK_FACTURACION=$VITE_MOCK_FACTURACION \
    VITE_MOCK_HISTORIAL=$VITE_MOCK_HISTORIAL \
    VITE_MOCK_ACTIVIDAD=$VITE_MOCK_ACTIVIDAD \
    VITE_SHOW_ACCESO_RAPIDO=$VITE_SHOW_ACCESO_RAPIDO

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

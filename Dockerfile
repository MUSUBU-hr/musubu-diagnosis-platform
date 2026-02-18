# musubu-diagnosis-platform
FROM nginx:alpine

# Cloud Run は PORT=8080 を要求するので nginx を 8080 で待受
RUN sed -i 's/listen\s\+80;/listen 8080;/' /etc/nginx/conf.d/default.conf

COPY . /usr/share/nginx/html

EXPOSE 8080

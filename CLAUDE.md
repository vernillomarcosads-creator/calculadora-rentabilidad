# CLAUDE.md

## Cache-busting de assets estáticos

`index.html` y `admin.html` referencian `assets/css/theme.css`, `assets/config.js`, `assets/js/api.js`, `assets/js/calculadora.js` y `assets/js/admin.js` con un query param de versión (`?v=2`, etc.). GitHub Pages sirve estos archivos con `cache-control: max-age=600`, así que sin ese query param los navegadores pueden quedarse hasta 10 minutos con una versión vieja después de cada deploy.

**Regla:** cada vez que se modifique `theme.css`, `config.js`, `api.js`, `calculadora.js` o `admin.js`, hay que bumpear el número de versión (`?v=3`, `?v=4`, etc.) en los tags `<script>` y `<link>` correspondientes de **ambos** `index.html` y `admin.html`, en el mismo commit que el cambio. No hace falta bumpear si el archivo modificado no cambió (ej. un cambio solo en `calculadora.js` no requiere bumpear `admin.js`, pero si `theme.css` cambió, hay que bumpear su versión en los dos HTML ya que ambos lo referencian).

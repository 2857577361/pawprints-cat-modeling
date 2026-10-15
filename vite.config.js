import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{chunkSizeWarningLimit:1000,rollupOptions:{input:{main:'index.html',coatReview:'coat-review.html'}}},server:{fs:{allow:['..']}}});

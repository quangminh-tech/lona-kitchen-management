import{defineConfig}from'vite';export default defineConfig({base:'./',build:{outDir:'dist-offline',rollupOptions:{output:{inlineDynamicImports:true}}}});

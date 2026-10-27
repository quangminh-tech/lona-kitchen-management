import {defineConfig} from 'vite';export default defineConfig({base:'./',server:{allowedHosts:['terminal.local'],proxy:{'/api':'http://127.0.0.1:5080'}}});

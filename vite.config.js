import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.js", // точка входа библиотеки
      name: "TeenyTinyRouter", // глобальное имя для UMD
      fileName: (format) => `teeny-tiny-router.${format}.js`,
    },
    rollupOptions: {
      // Указываем внешние зависимости, чтобы они не включались в сборку
      external: [],
      output: {
        globals: {},
      },
    },
  },
});

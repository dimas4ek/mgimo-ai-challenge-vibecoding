import { configure } from "@testing-library/react";

// `findBy*` и `waitFor` по умолчанию ждут 1 с. В общем `pnpm test` тесты API в это время
// поднимают PGlite, и первый рендер страницы в jsdom на медленной машине (Windows, CI) не успевает.
configure({ asyncUtilTimeout: 5_000 });

// В jsdom нет matchMedia, а переключатель темы в AppShell его читает. Тесты в node-окружении пропускаем.
if (typeof window !== "undefined") {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

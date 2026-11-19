import { configure } from "@testing-library/react";

// `findBy*` и `waitFor` по умолчанию ждут 1 с. В общем `pnpm test` тесты API в это время
// поднимают PGlite, и первый рендер страницы в jsdom на медленной машине (Windows, CI) не успевает.
configure({ asyncUtilTimeout: 5_000 });

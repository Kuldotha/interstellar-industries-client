import {copyFile} from 'node:fs/promises';
await copyFile(new URL('../../interstellar-industries-program/client/onchain.mjs',import.meta.url),new URL('../public/onchain.js',import.meta.url));

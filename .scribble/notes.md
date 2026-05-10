1. During CI/CD, for backend, in data-sources.ts, we might need to change to this:

```ts
  // entities: ["dist/**/*.entity.js"], // path to compiled entities
  // migrations: ["dist/migrations/*.js"],
```

It points to the build and avoids shipping TS sources.
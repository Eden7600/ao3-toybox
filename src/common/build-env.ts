// The custom builder injects SERVER_FEATURES via Vite `define`, the same way
// NODE_ENV and BROWSER are injected (there is no Vite mode, so
// import.meta.env is not reliable here). Building with SERVER_FEATURES=
// "disabled" compiles out the extension's own server-sync features: all
// tracking stays in the local store regardless of the connectToServer
// setting. Unset (tests, local builds) means enabled.
export const serverFeaturesEnabled = process.env.SERVER_FEATURES !== "disabled";

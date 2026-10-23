import {extractValue} from "@web-watcher/shared";

const [selector = ".price", url = "http://localhost:8080/"] = process.argv.slice(2);
const html = await (await fetch(url)).text();
console.log(JSON.stringify(extractValue(html, selector)));

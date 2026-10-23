import {load} from "cheerio";

export function extractValue(html: string, selector: string): string | null {
    const $ = load(html);
    const element = $(selector).first();
    if (element.length === 0) {
        return null;
    }
    const text = element.text().replace(/\s+/g, " ").trim();
    return text === "" ? null : text;
}
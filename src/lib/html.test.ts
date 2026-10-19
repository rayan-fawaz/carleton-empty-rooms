import { describe, expect, it } from "vitest";
import { decodeEntities, stripTags } from "./html";

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("St. Patrick&#8217;s &amp; Nideyin&#xE0;n&nbsp;&quot;A&quot;")).toBe(
      'St. Patrick’s & Nideyinàn "A"',
    );
  });

  it("decodes in one pass, so escaped entities stay escaped", () => {
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });

  it("leaves unknown or invalid entities alone", () => {
    expect(decodeEntities("&bogus; &#99999999;")).toBe("&bogus; &#99999999;");
  });
});

describe("stripTags", () => {
  it("keeps only text", () => {
    expect(stripTags("<b>SES: TT Blockoff</b> <br/>")).toBe("SES: TT Blockoff ");
  });
});

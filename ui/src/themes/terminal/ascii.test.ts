import { expect, test } from "vitest";
import { asciiBar, asciiNumber } from "./ascii";

test("every numeral is drawn out of itself on an even grid", () => {
  for (const digit of "0123456789-") {
    const { body, shadow } = asciiNumber(digit);
    expect(body).toHaveLength(10);
    for (const row of [...body, ...shadow]) expect(row).toHaveLength(12);
    expect(new Set(body.join("").replaceAll(" ", ""))).toEqual(new Set(digit));
  }
});

test("a blank place draws nothing", () => {
  expect(asciiNumber(" ").body.join("").trim()).toBe("");
});

test("the bar keeps its length and its ends", () => {
  expect(asciiBar(0, 4)).toBe("[░░░░]");
  expect(asciiBar(0.5, 4)).toBe("[██░░]");
  expect(asciiBar(1.2, 4)).toBe("[████]");
});

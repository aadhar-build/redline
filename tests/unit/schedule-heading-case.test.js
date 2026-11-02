// Ticket 13d: a schedule heading's title must start with a real capital letter or digit. A wrapped body
// line starting with the schedule's name is not a heading (fail closed). Made-up strings only.
import { describe, expect, it } from "vitest";
import { findOutsideReferences } from "../../lib/review/outside-references.js";

const keys = (text) => findOutsideReferences(text).found.map((f) => f.key);

describe("schedule headings are matched case-sensitively after the name", () => {
  it.each([
    "1. The fee is set out in the\nSchedule A and the Customer will pay the\nfee on time.\n",
    "1. The rates appear in\nANNEXURE B as agreed between the parties\nfrom the start date.\n",
  ])("a wrapped body line is not a heading: %j", (text) => {
    expect(keys(text)).toHaveLength(1);
  });

  it.each([
    "1. The fees in Schedule A apply.\n\nSCHEDULE A\nFees\n",
    "1. The fees in Schedule A apply.\n\nSchedule A - fees and charges\n",
    "1. The fees in Schedule A apply.\n\nSchedule A Fees And Charges\n",
    "1. The fees in Schedule A apply.\n\nschedule a: fees\n",
  ])("a real heading still counts: %j", (text) => {
    expect(keys(text)).toEqual([]);
  });

  it("stays fast on long adversarial lines", () => {
    const text = `1. See Schedule A.\n${"Schedule A " + "a ".repeat(50000)}\n${"Schedule A".repeat(20000)}\n`;
    const t = performance.now();
    findOutsideReferences(text);
    expect(performance.now() - t).toBeLessThan(500);
  });
});

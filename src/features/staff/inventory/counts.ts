/** Figures shown on a count review. The API's variance wins over a client subtraction. */
export function countReview(line: {
  expected_qty: string;
  counted_qty: string | null;
  variance_qty: string | null;
  variance_value: string | null;
}): { expected: string; counted: string | null; varianceQty: string | null; varianceValue: string | null } {
  return {
    expected: line.expected_qty,
    counted: line.counted_qty,
    varianceQty: line.variance_qty,
    varianceValue: line.variance_value,
  };
}

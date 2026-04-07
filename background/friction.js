/**
 * Maps how many times a domain triggered an intercept this session → UI stage (1–3).
 */
export function frictionStageForVisit(visitCount, frictionStyle) {
  if (frictionStyle === 'firm') {
    if (visitCount <= 1) return 1;
    return 3;
  }
  if (visitCount <= 1) return 1;
  if (visitCount === 2) return 2;
  return 3;
}

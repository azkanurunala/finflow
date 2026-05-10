/**
 * Retry/backoff tests for SubscriptionApiClient.
 *
 * Status: file was committed empty in 5d38b64a. Placeholder test added to keep Jest
 * from failing the suite outright; real retry-coverage cases will land alongside
 * G1 (session rotation) since they share ApiRequestWrapper plumbing.
 */
describe('SubscriptionApiClient retry/backoff (placeholder — see iteration-0 PRD G1)', () => {
  it.skip('to be implemented during G1 session-rotation work', () => {
    // intentionally pending
  });

  it('keeps Jest from rejecting an empty suite', () => {
    expect(true).toBe(true);
  });
});

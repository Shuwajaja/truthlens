# Fixed private reader — targeted browser evidence

The production Viewer build was exercised through the actual Unix HTTP reader
and a local loopback byte-forwarder, using a **synthetic unsigned registered test
snapshot**. Test-only ownership validators were substituted to permit temporary
unprivileged files. This is not SSH, a real private run, host installation or
worker-isolation evidence. The 503 response used for the error state was mocked.

[Machine-readable final results](review.json) record the tested source commit,
viewports and individual findings. The targeted matrix covers disconnected,
catalog, document and connection-error states at 1440×900 and 390×844 in both
themes, with unrestricted axe scans and computed-style review of incomplete
contrast findings. Keyboard Connect/Open, zero source requests before Connect,
selected-run reload and explicit reconnect, and no stored event payload are
also checked. Unrelated old browser flows are not repeated.

Earlier attempts caught a root-navigation query rejection and intermittent
parallel static-asset failures with the initial serial server/backlog 2. These
were fixed before the final matrix: bounded root metadata serves the same index,
and a fixed two-worker pool with backlog 16 handles parallel browser assets.
A leftover fixture-only sidebar description was also corrected. Rebuilding
replaced a static directory held open by the temporary reader, requiring that
test process to restart before checking the new build. None of these failed
attempts is counted as a pass; intermediate logs remain outside the repository.

The synthetic fixture contains a passing criterion so that projection/rendering
can be inspected. Its result is not a result from a user's actual task.


Final tested code: `723db5f` (full commit in review.json). The final scan results
and network/runtime checks below are generated only after the fixed reader is
restarted on that code. The earlier initial 16 scans are not added to this count.


Observed final result: **16 scans, zero axe violations, zero static-asset transport
failures and zero browser runtime errors**. Two incomplete contrast findings
passed the recorded computed-style checks. The synthetic API503 error and
navigation/unmount request cancellations are not asserted to be real outages.

import { defaultPolicy, freezeData, freezeSnapshot } from '../core/graph';
import type { ProjectState, ScanPolicy } from '../core/graph';
import type { ScannerPort } from '../ports/scanner';

export class ProjectController {
  private state: ProjectState = freezeData({
    version: 0,
    sessionId: null,
    rootPath: null,
    status: 'empty',
    discovered: 0,
    policy: defaultPolicy,
    snapshot: null,
    error: null,
  });
  private cancel: (() => void) | undefined;
  constructor(
    private readonly scanner: ScannerPort,
    private readonly newId: () => string,
  ) {}
  getState(): ProjectState {
    return this.state;
  }
  private publish(update: Partial<ProjectState>) {
    this.state = freezeData({
      ...this.state,
      ...update,
      version: this.state.version + 1,
    });
  }
  open(rootPath: string, policy: ScanPolicy = defaultPolicy) {
    const previous = this.cancel;
    this.cancel = undefined;
    const sessionId = this.newId();
    this.publish({
      sessionId,
      rootPath,
      policy,
      status: 'scanning',
      discovered: 0,
      snapshot: null,
      error: null,
    });
    previous?.();
    try {
      this.cancel = this.scanner.start(
        { sessionId, rootPath, policy },
        (event) => {
          if (
            this.state.sessionId !== sessionId ||
            this.state.status !== 'scanning'
          )
            return;
          if (event.type === 'progress')
            this.publish({ discovered: event.discovered });
          else if (event.type === 'failed')
            this.publish({ status: 'failed', error: event.message });
          else {
            try {
              if (event.snapshot.sessionId !== sessionId) return;
              const snapshot = freezeSnapshot(event.snapshot);
              this.publish({
                snapshot,
                discovered: snapshot.nodes.length,
                status:
                  snapshot.coverage === 'complete' ? 'scanned' : 'incomplete',
              });
            } catch {
              this.publish({
                status: 'failed',
                error: 'Invalid source graph rejected.',
              });
            }
          }
        },
      );
    } catch (error) {
      this.publish({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Scan failed.',
      });
    }
  }
  refresh(policy = this.state.policy) {
    if (this.state.rootPath) this.open(this.state.rootPath, policy);
  }
  close() {
    // Invalidate before cancellation: even a synchronous cancellation callback is obsolete.
    this.publish({
      sessionId: null,
      rootPath: null,
      status: 'empty',
      discovered: 0,
      snapshot: null,
      error: null,
      policy: defaultPolicy,
    });
    this.cancel?.();
    this.cancel = undefined;
  }
}

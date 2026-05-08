package vip.mate.workflow.runtime;

/**
 * Outcome reported by a {@link StepAdapter#execute}. Records:
 * <ul>
 *   <li>{@link State} — succeeded / skipped / failed; the runner translates
 *       these to {@code mate_workflow_run_step.state}.</li>
 *   <li>{@code outputPayloadUri} — payload URI for the step's output, or
 *       {@code null} when the step produced nothing (e.g. skipped, collect).</li>
 *   <li>{@code outputContentType} — resolved content type, defaults to
 *       {@code text}; lets the runner persist {@code output_content_type}
 *       without rebuilding the step contract.</li>
 *   <li>{@code outputValue} — the in-memory value to publish into the
 *       run context's {@code outputs} map. {@link String} for text content,
 *       {@link java.util.Map} / {@link java.util.List} for json content.
 *       {@code null} when the step has no {@code outputVar}.</li>
 *   <li>{@code outputSummary} / {@code errorMessage} — short labels for the
 *       step row; both optional.</li>
 * </ul>
 */
public record StepResult(
        State state,
        String outputPayloadUri,
        String outputContentType,
        Object outputValue,
        String outputSummary,
        String errorMessage
) {

    public enum State { SUCCEEDED, SKIPPED, FAILED }

    public static StepResult succeeded(String payloadUri, String contentType, Object value, String summary) {
        return new StepResult(State.SUCCEEDED, payloadUri, contentType, value, summary, null);
    }

    public static StepResult skipped(String reason) {
        return new StepResult(State.SKIPPED, null, null, null, reason, null);
    }

    public static StepResult failed(String errorMessage) {
        return new StepResult(State.FAILED, null, null, null, null, errorMessage);
    }
}

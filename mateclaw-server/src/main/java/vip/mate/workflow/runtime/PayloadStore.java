package vip.mate.workflow.runtime;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vip.mate.workflow.model.WorkflowPayloadEntity;
import vip.mate.workflow.repository.WorkflowPayloadMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

/**
 * Write-through facade over {@code mate_workflow_payload}. v0 stores every
 * payload inline (storage_kind = "inline"); the table schema reserves room for
 * a fs / s3 / oss spill-over flavour but no caller wires that yet. Callers
 * receive a stable URI of the form {@code mwf://{workspaceId}/{uuid}} and
 * resolve it back via {@link #readString(String)} or {@link #readBytes(String)}.
 */
@Service
public class PayloadStore {

    private static final String SCHEME = "mwf://";
    private static final String STORAGE_KIND_INLINE = "inline";

    private final WorkflowPayloadMapper payloadMapper;
    private final ObjectMapper objectMapper;

    public PayloadStore(WorkflowPayloadMapper payloadMapper, ObjectMapper objectMapper) {
        this.payloadMapper = payloadMapper;
        this.objectMapper = objectMapper;
    }

    /** Store a UTF-8 string payload and return its stable URI. */
    public String storeString(long workspaceId, String body, String contentType) {
        byte[] bytes = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
        return storeBytes(workspaceId, bytes, contentType == null ? "text/plain" : contentType);
    }

    /** JSON-encode {@code value} and store it. {@code contentType} is fixed to {@code application/json}. */
    public String storeJson(long workspaceId, Object value) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(value);
            return storeBytes(workspaceId, bytes, "application/json");
        } catch (JsonProcessingException e) {
            throw new PayloadStoreException("failed to serialize payload as JSON: " + e.getMessage(), e);
        }
    }

    /** Store raw bytes and return the URI. */
    public String storeBytes(long workspaceId, byte[] bytes, String contentType) {
        Objects.requireNonNull(bytes, "bytes");
        String uri = SCHEME + workspaceId + "/" + UUID.randomUUID();

        WorkflowPayloadEntity row = new WorkflowPayloadEntity();
        row.setPayloadUri(uri);
        row.setWorkspaceId(workspaceId);
        row.setContentBytes(bytes);
        row.setStorageKind(STORAGE_KIND_INLINE);
        row.setContentType(contentType);
        row.setSha256(sha256Hex(bytes));
        row.setSizeBytes((long) bytes.length);
        row.setCreatedAt(LocalDateTime.now());
        payloadMapper.insert(row);
        return uri;
    }

    /** Resolve a payload URI to its raw bytes; throws when the URI is unknown. */
    public byte[] readBytes(String payloadUri) {
        WorkflowPayloadEntity row = lookup(payloadUri);
        return row.getContentBytes() == null ? new byte[0] : row.getContentBytes();
    }

    /** Resolve a payload URI to its UTF-8 decoded string body. */
    public String readString(String payloadUri) {
        return new String(readBytes(payloadUri), StandardCharsets.UTF_8);
    }

    /** Resolve a payload URI to its JSON body parsed back into the requested shape. */
    public <T> T readJson(String payloadUri, Class<T> type) {
        try {
            return objectMapper.readValue(readBytes(payloadUri), type);
        } catch (Exception e) {
            throw new PayloadStoreException(
                    "failed to deserialize payload " + payloadUri + " as " + type.getSimpleName()
                            + ": " + e.getMessage(),
                    e);
        }
    }

    private WorkflowPayloadEntity lookup(String payloadUri) {
        WorkflowPayloadEntity row = payloadMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<WorkflowPayloadEntity>()
                        .eq(WorkflowPayloadEntity::getPayloadUri, payloadUri));
        if (row == null) {
            throw new PayloadStoreException("payload not found: " + payloadUri);
        }
        return row;
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is part of the JCA standard set — should never happen.
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /** Wrapper exception for payload-store failures. */
    public static class PayloadStoreException extends RuntimeException {
        public PayloadStoreException(String message) { super(message); }
        public PayloadStoreException(String message, Throwable cause) { super(message, cause); }
    }
}

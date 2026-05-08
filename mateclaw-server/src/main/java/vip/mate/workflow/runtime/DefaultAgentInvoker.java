package vip.mate.workflow.runtime;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Component;
import vip.mate.agent.AgentService;
import vip.mate.agent.model.AgentEntity;
import vip.mate.agent.repository.AgentMapper;

/**
 * Production binding for {@link AgentInvoker}. Looks agents up by name within
 * the workspace via {@link AgentMapper} and delegates execution to
 * {@link AgentService#chat(Long, String, String)}. The conversation id is
 * passed through as-is — the runner is responsible for generating an ephemeral
 * id per step so multi-step runs do not collide on conversation history.
 */
@Component
public class DefaultAgentInvoker implements AgentInvoker {

    private final AgentService agentService;
    private final AgentMapper agentMapper;

    public DefaultAgentInvoker(AgentService agentService, AgentMapper agentMapper) {
        this.agentService = agentService;
        this.agentMapper = agentMapper;
    }

    @Override
    public String invoke(long agentId, String prompt, String conversationId) {
        return agentService.chat(agentId, prompt, conversationId);
    }

    @Override
    public Long resolveAgentId(long workspaceId, String agentName) {
        if (agentName == null || agentName.isBlank()) return null;
        AgentEntity entity = agentMapper.selectOne(new LambdaQueryWrapper<AgentEntity>()
                .eq(AgentEntity::getWorkspaceId, workspaceId)
                .eq(AgentEntity::getName, agentName.trim())
                .eq(AgentEntity::getEnabled, true));
        if (entity == null) {
            // Fall back to a workspace-agnostic lookup so global agents still
            // resolve. This mirrors how the workflow ACL phase counts an agent
            // as "resolvable" if it exists anywhere the user can see it.
            entity = agentMapper.selectOne(new LambdaQueryWrapper<AgentEntity>()
                    .eq(AgentEntity::getName, agentName.trim())
                    .eq(AgentEntity::getEnabled, true));
        }
        return entity == null ? null : entity.getId();
    }
}

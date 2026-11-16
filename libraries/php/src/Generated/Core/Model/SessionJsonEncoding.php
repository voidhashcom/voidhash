<?php

namespace Voidhash\Generated\Core\Model;

class SessionJsonEncoding
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The kind of credential: `dashboard_session` for a person signed in to the dashboard, `cli_key` for a person's CLI, `mcp_client` for an app a person connected over MCP, or `secret_key` for a project secret key.
     *
     * @var string
     */
    protected $kind;
    /**
     * @var SessionPersonJsonEncoding
     */
    protected $person;
    /**
     * The connected app making the request, for a CLI key or an MCP client; null for a dashboard session or a secret key.
     *
     * @var string|null
     */
    protected $connectedAppId;
    /**
     * Whether the person limited this connected app to reading, so its changes are refused. Always false for other credentials.
     *
     * @var bool
     */
    protected $isReadOnly;
    /**
     * The organizations the credential can use; empty for a project secret key.
     *
     * @var list<SessionOrganizationJsonEncoding>
     */
    protected $organizations;
    /**
     * The projects the credential can use; exactly its own for a project secret key.
     *
     * @var list<SessionProjectJsonEncoding>
     */
    protected $projects;
    /**
     * The kind of credential: `dashboard_session` for a person signed in to the dashboard, `cli_key` for a person's CLI, `mcp_client` for an app a person connected over MCP, or `secret_key` for a project secret key.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * The kind of credential: `dashboard_session` for a person signed in to the dashboard, `cli_key` for a person's CLI, `mcp_client` for an app a person connected over MCP, or `secret_key` for a project secret key.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * @return SessionPersonJsonEncoding
     */
    public function getPerson(): SessionPersonJsonEncoding
    {
        return $this->person;
    }
    /**
     * @param SessionPersonJsonEncoding $person
     *
     * @return self
     */
    public function setPerson(SessionPersonJsonEncoding $person): self
    {
        $this->initialized['person'] = true;
        $this->person = $person;
        return $this;
    }
    /**
     * The connected app making the request, for a CLI key or an MCP client; null for a dashboard session or a secret key.
     *
     * @return string|null
     */
    public function getConnectedAppId(): ?string
    {
        return $this->connectedAppId;
    }
    /**
     * The connected app making the request, for a CLI key or an MCP client; null for a dashboard session or a secret key.
     *
     * @param string|null $connectedAppId
     *
     * @return self
     */
    public function setConnectedAppId(?string $connectedAppId): self
    {
        $this->initialized['connectedAppId'] = true;
        $this->connectedAppId = $connectedAppId;
        return $this;
    }
    /**
     * Whether the person limited this connected app to reading, so its changes are refused. Always false for other credentials.
     *
     * @return bool
     */
    public function getIsReadOnly(): bool
    {
        return $this->isReadOnly;
    }
    /**
     * Whether the person limited this connected app to reading, so its changes are refused. Always false for other credentials.
     *
     * @param bool $isReadOnly
     *
     * @return self
     */
    public function setIsReadOnly(bool $isReadOnly): self
    {
        $this->initialized['isReadOnly'] = true;
        $this->isReadOnly = $isReadOnly;
        return $this;
    }
    /**
     * The organizations the credential can use; empty for a project secret key.
     *
     * @return list<SessionOrganizationJsonEncoding>
     */
    public function getOrganizations(): array
    {
        return $this->organizations;
    }
    /**
     * The organizations the credential can use; empty for a project secret key.
     *
     * @param list<SessionOrganizationJsonEncoding> $organizations
     *
     * @return self
     */
    public function setOrganizations(array $organizations): self
    {
        $this->initialized['organizations'] = true;
        $this->organizations = $organizations;
        return $this;
    }
    /**
     * The projects the credential can use; exactly its own for a project secret key.
     *
     * @return list<SessionProjectJsonEncoding>
     */
    public function getProjects(): array
    {
        return $this->projects;
    }
    /**
     * The projects the credential can use; exactly its own for a project secret key.
     *
     * @param list<SessionProjectJsonEncoding> $projects
     *
     * @return self
     */
    public function setProjects(array $projects): self
    {
        $this->initialized['projects'] = true;
        $this->projects = $projects;
        return $this;
    }
}
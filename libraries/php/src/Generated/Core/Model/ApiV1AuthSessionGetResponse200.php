<?php

namespace Voidhash\Generated\Core\Model;

class ApiV1AuthSessionGetResponse200
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
     * @var string
     */
    protected $method;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var list<ApiV1AuthSessionGetResponse200OrganizationsItem>
     */
    protected $organizations;
    /**
     * @var list<ApiV1AuthSessionGetResponse200ProjectsItem>
     */
    protected $projects;
    /**
     * @return string
     */
    public function getMethod(): string
    {
        return $this->method;
    }
    /**
     * @param string $method
     *
     * @return self
     */
    public function setMethod(string $method): self
    {
        $this->initialized['method'] = true;
        $this->method = $method;
        return $this;
    }
    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * @return list<ApiV1AuthSessionGetResponse200OrganizationsItem>
     */
    public function getOrganizations(): array
    {
        return $this->organizations;
    }
    /**
     * @param list<ApiV1AuthSessionGetResponse200OrganizationsItem> $organizations
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
     * @return list<ApiV1AuthSessionGetResponse200ProjectsItem>
     */
    public function getProjects(): array
    {
        return $this->projects;
    }
    /**
     * @param list<ApiV1AuthSessionGetResponse200ProjectsItem> $projects
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
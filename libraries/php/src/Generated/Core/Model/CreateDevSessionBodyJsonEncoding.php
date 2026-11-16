<?php

namespace Voidhash\Generated\Core\Model;

class CreateDevSessionBodyJsonEncoding
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
     * The run's server, on the loopback interface: `http://127.0.0.1:<port>`.
     *
     * @var string
     */
    protected $url;
    /**
     * The token the run's server requires: 32 to 255 letters, digits, dashes or underscores.
     *
     * @var string
     */
    protected $token;
    /**
     * The components the run serves, at most 64.
     *
     * @var list<DevSessionComponentJsonEncoding>
     */
    protected $components;
    /**
     * The run's server, on the loopback interface: `http://127.0.0.1:<port>`.
     *
     * @return string
     */
    public function getUrl(): string
    {
        return $this->url;
    }
    /**
     * The run's server, on the loopback interface: `http://127.0.0.1:<port>`.
     *
     * @param string $url
     *
     * @return self
     */
    public function setUrl(string $url): self
    {
        $this->initialized['url'] = true;
        $this->url = $url;
        return $this;
    }
    /**
     * The token the run's server requires: 32 to 255 letters, digits, dashes or underscores.
     *
     * @return string
     */
    public function getToken(): string
    {
        return $this->token;
    }
    /**
     * The token the run's server requires: 32 to 255 letters, digits, dashes or underscores.
     *
     * @param string $token
     *
     * @return self
     */
    public function setToken(string $token): self
    {
        $this->initialized['token'] = true;
        $this->token = $token;
        return $this;
    }
    /**
     * The components the run serves, at most 64.
     *
     * @return list<DevSessionComponentJsonEncoding>
     */
    public function getComponents(): array
    {
        return $this->components;
    }
    /**
     * The components the run serves, at most 64.
     *
     * @param list<DevSessionComponentJsonEncoding> $components
     *
     * @return self
     */
    public function setComponents(array $components): self
    {
        $this->initialized['components'] = true;
        $this->components = $components;
        return $this;
    }
}
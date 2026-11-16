<?php

namespace Voidhash\Generated\Core\Model;

class FlowPackageDiagnostic
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
     * A stable code naming the problem.
     *
     * @var string
     */
    protected $code;
    /**
     * What is wrong, in plain language.
     *
     * @var string
     */
    protected $message;
    /**
     * The id of the design node the problem concerns; absent when it concerns no single node.
     *
     * @var string|null
     */
    protected $nodeId;
    /**
     * A stable code naming the problem.
     *
     * @return string
     */
    public function getCode(): string
    {
        return $this->code;
    }
    /**
     * A stable code naming the problem.
     *
     * @param string $code
     *
     * @return self
     */
    public function setCode(string $code): self
    {
        $this->initialized['code'] = true;
        $this->code = $code;
        return $this;
    }
    /**
     * What is wrong, in plain language.
     *
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * What is wrong, in plain language.
     *
     * @param string $message
     *
     * @return self
     */
    public function setMessage(string $message): self
    {
        $this->initialized['message'] = true;
        $this->message = $message;
        return $this;
    }
    /**
     * The id of the design node the problem concerns; absent when it concerns no single node.
     *
     * @return string|null
     */
    public function getNodeId(): ?string
    {
        return $this->nodeId;
    }
    /**
     * The id of the design node the problem concerns; absent when it concerns no single node.
     *
     * @param string|null $nodeId
     *
     * @return self
     */
    public function setNodeId(?string $nodeId): self
    {
        $this->initialized['nodeId'] = true;
        $this->nodeId = $nodeId;
        return $this;
    }
}
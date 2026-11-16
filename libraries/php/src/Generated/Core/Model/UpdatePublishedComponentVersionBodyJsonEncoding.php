<?php

namespace Voidhash\Generated\Core\Model;

class UpdatePublishedComponentVersionBodyJsonEncoding
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
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @var string
     */
    protected $status;
    /**
     * Why the version is deprecated or yanked, for installers; restoring a version to `ready` clears it.
     *
     * @var string|null
     */
    protected $statusMessage;
    /**
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * The status of a registry component version: `ready` versions can be installed; `deprecated` and `yanked` ones cannot. A deprecation can be lifted; a yank is final.
     *
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
    /**
     * Why the version is deprecated or yanked, for installers; restoring a version to `ready` clears it.
     *
     * @return string|null
     */
    public function getStatusMessage(): ?string
    {
        return $this->statusMessage;
    }
    /**
     * Why the version is deprecated or yanked, for installers; restoring a version to `ready` clears it.
     *
     * @param string|null $statusMessage
     *
     * @return self
     */
    public function setStatusMessage(?string $statusMessage): self
    {
        $this->initialized['statusMessage'] = true;
        $this->statusMessage = $statusMessage;
        return $this;
    }
}
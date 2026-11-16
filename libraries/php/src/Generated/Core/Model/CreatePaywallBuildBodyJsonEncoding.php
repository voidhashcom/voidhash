<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaywallBuildBodyJsonEncoding
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
     * The design version you reviewed; when the design has changed since, nothing is built. Omitted, the current design is built.
     *
     * @var int|null
     */
    protected $documentVersion;
    /**
     * The design version you reviewed; when the design has changed since, nothing is built. Omitted, the current design is built.
     *
     * @return int|null
     */
    public function getDocumentVersion(): ?int
    {
        return $this->documentVersion;
    }
    /**
     * The design version you reviewed; when the design has changed since, nothing is built. Omitted, the current design is built.
     *
     * @param int|null $documentVersion
     *
     * @return self
     */
    public function setDocumentVersion(?int $documentVersion): self
    {
        $this->initialized['documentVersion'] = true;
        $this->documentVersion = $documentVersion;
        return $this;
    }
}
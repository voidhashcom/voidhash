<?php

namespace Voidhash\Generated\Core\Model;

class FeedbackJsonEncoding
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
     * The feedback's id, `vh_fb_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The feedback's id, `vh_fb_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The feedback's id, `vh_fb_...`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
}
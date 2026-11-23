<?php

namespace Voidhash\Generated\Core\Model;

class ReportContentEdit
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
     * Text of the report's Markdown, as `reports.get` answers it, to replace. It must occur exactly once, after the edits before it.
     *
     * @var string
     */
    protected $oldText;
    /**
     * What replaces it; empty removes it.
     *
     * @var string
     */
    protected $newText;
    /**
     * Text of the report's Markdown, as `reports.get` answers it, to replace. It must occur exactly once, after the edits before it.
     *
     * @return string
     */
    public function getOldText(): string
    {
        return $this->oldText;
    }
    /**
     * Text of the report's Markdown, as `reports.get` answers it, to replace. It must occur exactly once, after the edits before it.
     *
     * @param string $oldText
     *
     * @return self
     */
    public function setOldText(string $oldText): self
    {
        $this->initialized['oldText'] = true;
        $this->oldText = $oldText;
        return $this;
    }
    /**
     * What replaces it; empty removes it.
     *
     * @return string
     */
    public function getNewText(): string
    {
        return $this->newText;
    }
    /**
     * What replaces it; empty removes it.
     *
     * @param string $newText
     *
     * @return self
     */
    public function setNewText(string $newText): self
    {
        $this->initialized['newText'] = true;
        $this->newText = $newText;
        return $this;
    }
}
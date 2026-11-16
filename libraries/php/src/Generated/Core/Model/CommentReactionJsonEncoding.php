<?php

namespace Voidhash\Generated\Core\Model;

class CommentReactionJsonEncoding
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
    protected $emoji;
    /**
     * @var list<string>
     */
    protected $participants;
    /**
     * @return string
     */
    public function getEmoji(): string
    {
        return $this->emoji;
    }
    /**
     * @param string $emoji
     *
     * @return self
     */
    public function setEmoji(string $emoji): self
    {
        $this->initialized['emoji'] = true;
        $this->emoji = $emoji;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getParticipants(): array
    {
        return $this->participants;
    }
    /**
     * @param list<string> $participants
     *
     * @return self
     */
    public function setParticipants(array $participants): self
    {
        $this->initialized['participants'] = true;
        $this->participants = $participants;
        return $this;
    }
}
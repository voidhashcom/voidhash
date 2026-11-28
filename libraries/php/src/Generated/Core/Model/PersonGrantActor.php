<?php

namespace Voidhash\Generated\Core\Model;

class PersonGrantActor
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
     * Who acted: a `member` of your team (in the dashboard, the CLI or an AI assistant), a project secret key (`api_key`), a project `bot`, or Voidhash itself (`system`), which revokes a grant when two persons holding grants of the same perk are merged or when the person's data is erased.
     *
     * @var string
     */
    protected $type;
    /**
     * The member's user id, the secret key's id or the bot's key; null for a key recorded without an id. For `system`, why it revoked the grant: `person_merge`, when the person was merged with one holding a grant of the same perk that lasts at least as long, or `person_erasure`.
     *
     * @var string|null
     */
    protected $id;
    /**
     * Who acted: a `member` of your team (in the dashboard, the CLI or an AI assistant), a project secret key (`api_key`), a project `bot`, or Voidhash itself (`system`), which revokes a grant when two persons holding grants of the same perk are merged or when the person's data is erased.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * Who acted: a `member` of your team (in the dashboard, the CLI or an AI assistant), a project secret key (`api_key`), a project `bot`, or Voidhash itself (`system`), which revokes a grant when two persons holding grants of the same perk are merged or when the person's data is erased.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * The member's user id, the secret key's id or the bot's key; null for a key recorded without an id. For `system`, why it revoked the grant: `person_merge`, when the person was merged with one holding a grant of the same perk that lasts at least as long, or `person_erasure`.
     *
     * @return string|null
     */
    public function getId(): ?string
    {
        return $this->id;
    }
    /**
     * The member's user id, the secret key's id or the bot's key; null for a key recorded without an id. For `system`, why it revoked the grant: `person_merge`, when the person was merged with one holding a grant of the same perk that lasts at least as long, or `person_erasure`.
     *
     * @param string|null $id
     *
     * @return self
     */
    public function setId(?string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
}
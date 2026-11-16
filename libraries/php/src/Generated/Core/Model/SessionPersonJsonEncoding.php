<?php

namespace Voidhash\Generated\Core\Model;

class SessionPersonJsonEncoding
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
     * The person's id, `user_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The person's name.
     *
     * @var string
     */
    protected $name;
    /**
     * The email address the person signs in with.
     *
     * @var string
     */
    protected $email;
    /**
     * The person's id, `user_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The person's id, `user_...`.
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
    /**
     * The person's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The person's name.
     *
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
     * The email address the person signs in with.
     *
     * @return string
     */
    public function getEmail(): string
    {
        return $this->email;
    }
    /**
     * The email address the person signs in with.
     *
     * @param string $email
     *
     * @return self
     */
    public function setEmail(string $email): self
    {
        $this->initialized['email'] = true;
        $this->email = $email;
        return $this;
    }
}
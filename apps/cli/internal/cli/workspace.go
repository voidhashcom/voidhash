package cli

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
)

// OrganizationKind is how organizations read in messages and prompts, and
// what they answer to: their id, slug or name.
var OrganizationKind = ItemKind[api.SessionOrganizationJsonEncoding]{
	Noun: "organization",
	ID:   func(organization api.SessionOrganizationJsonEncoding) string { return organization.Id },
	Label: func(organization api.SessionOrganizationJsonEncoding) string {
		return organization.Name + " (" + organization.Slug + ")"
	},
	ListCommand:   "voidhash org list",
	CreateCommand: "voidhash org create",
	Keys:          func(organization api.SessionOrganizationJsonEncoding) []string { return []string{organization.Slug} },
	Names:         func(organization api.SessionOrganizationJsonEncoding) []string { return []string{organization.Name} },
}

// AddOrgFlag adds --org to a command that acts on an organization. Pass its
// value to [App.ResolveOrganization].
func AddOrgFlag(cmd *cobra.Command) *string {
	return cmd.Flags().String("org", "", "Organization to act on: its slug, name or id (default: the organization of this directory's or your default project)")
}

// ResolveOrganization decides the organization an organization-scoped
// command acts on: the one flag (--org) names; else the only one the
// session can use; else the organization of the project this directory
// names or is linked to, or of the default project; else the person chooses
// on a terminal. It never asks for a project.
func (a *App) ResolveOrganization(ctx context.Context, flag string) (api.SessionOrganizationJsonEncoding, error) {
	var none api.SessionOrganizationJsonEncoding
	session, err := a.Session(ctx)
	if err != nil {
		return none, err
	}
	organizations := session.Organizations
	if flag != "" {
		return FindItem(OrganizationKind, organizations, flag)
	}
	switch len(organizations) {
	case 1:
		return organizations[0], nil
	case 0:
		return none, &UserError{
			Message:  "This credential belongs to no organization.",
			Hint:     "Sign in as yourself with 'voidhash login', or create one with 'voidhash org create'.",
			ExitCode: ExitNotFound,
		}
	}

	organizationID := ""
	directoryConfig, found, err := a.DirectoryConfig()
	if err != nil {
		return none, err
	}
	settings, err := a.Config()
	if err != nil {
		return none, err
	}
	if found {
		_, project, err := ProjectNamedBy(directoryConfig, session)
		if err != nil {
			return none, err
		}
		organizationID = project.OrganizationId
	} else {
		projectID := settings.DefaultProject
		if _, linked, ok := LinkFor(settings.Links, a.Dir); ok {
			projectID = linked
		}
		if project := session.Project(projectID); project != nil {
			organizationID = project.OrganizationId
		}
	}
	for _, organization := range organizations {
		if organization.Id == organizationID {
			return organization, nil
		}
	}

	if !a.IsInteractive() {
		lines := []string{fmt.Sprintf("Which organization? You belong to %d:", len(organizations))}
		for _, organization := range organizations {
			lines = append(lines, "  "+OrganizationKind.Label(organization))
		}
		return none, &UserError{
			Message:  strings.Join(lines, "\n"),
			Hint:     "Pass --org <organization>.",
			ExitCode: ExitUsage,
		}
	}
	return ChooseItem(ctx, a, OrganizationKind, organizations, "")
}

// LogoFlags are --logo and --remove-logo of an `edit` command.
type LogoFlags struct {
	// File is the image to use as the logo; empty when --logo was not passed.
	File string
	// Remove is --remove-logo.
	Remove bool
}

// AddLogoFlags adds --logo and --remove-logo to an `edit` command.
func AddLogoFlags(cmd *cobra.Command) *LogoFlags {
	flags := &LogoFlags{}
	cmd.Flags().StringVar(&flags.File, "logo", "", "A PNG, JPEG or WebP image `file` of up to 2 MB to use as the logo")
	cmd.Flags().BoolVar(&flags.Remove, "remove-logo", false, "Remove the logo")
	return flags
}

// Check fails when both flags were passed.
func (f *LogoFlags) Check() error {
	if f.File != "" && f.Remove {
		return Usagef("--logo and --remove-logo cannot be combined.").WithHint("Pass one of them.")
	}
	return nil
}

var imageTypes = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
}

// ReadLogo reads the image at file as the avatar body the API takes. A
// relative file is read from the directory the command runs in.
func (a *App) ReadLogo(file string) (api.AvatarImageBodyJsonEncoding, error) {
	contentType, ok := imageTypes[strings.ToLower(filepath.Ext(file))]
	if !ok {
		return api.AvatarImageBodyJsonEncoding{}, Usagef("%s is not a PNG, JPEG or WebP image.", file)
	}
	path := file
	if !filepath.IsAbs(path) {
		path = filepath.Join(a.Dir, path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return api.AvatarImageBodyJsonEncoding{}, Usagef("Could not read %s.", file)
	}
	return api.AvatarImageBodyJsonEncoding{ContentType: contentType, ImageBase64: base64.StdEncoding.EncodeToString(data)}, nil
}

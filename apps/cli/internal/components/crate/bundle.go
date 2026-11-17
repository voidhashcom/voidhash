package crate

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/components/definition"
)

// BundleFile is an image of a bundle.
type BundleFile struct {
	Base64      string `json:"base64"`
	ContentType string `json:"contentType"`
}

// BundleThumbnail is the picture of one preview state.
type BundleThumbnail struct {
	State       string `json:"state"`
	Base64      string `json:"base64"`
	ContentType string `json:"contentType"`
}

// Bundle is the request that publishes a bundle directory to the registry.
type Bundle struct {
	DefinitionJSON string            `json:"definitionJson"`
	ModuleBase64   string            `json:"moduleBase64"`
	PanelBase64    *string           `json:"panelBase64,omitempty"`
	Icon           *BundleFile       `json:"icon,omitempty"`
	Thumbnails     []BundleThumbnail `json:"thumbnails"`
	Readme         *string           `json:"readme,omitempty"`
	AgentGuide     *string           `json:"agentGuide,omitempty"`
}

// BundleError is a problem with a bundle directory that its author fixes.
type BundleError struct {
	Message string
	Hint    string
}

func (e *BundleError) Error() string { return e.Message }

var imageTypes = map[string]string{
	".png":  "image/png",
	".svg":  "image/svg+xml",
	".webp": "image/webp",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
}

// BundleImageType is the content type of a bundle image file; empty for
// other files.
func BundleImageType(fileName string) string {
	dot := strings.LastIndex(fileName, ".")
	if dot < 0 {
		return ""
	}
	return imageTypes[strings.ToLower(fileName[dot:])]
}

// WasmFileName is the file cargo writes for a cdylib crate: its package name
// with dashes as underscores.
func WasmFileName(packageName string) string {
	return strings.ReplaceAll(packageName, "-", "_") + ".wasm"
}

var iconPattern = regexp.MustCompile(`(?i)^icon\.(png|svg|webp)$`)

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func optionalText(path string) (*string, error) {
	content, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	read := text(content)
	return &read, nil
}

// ReadBundle reads a component bundle directory into a publish request:
//
//   - component.json, the component definition (required);
//   - module.wasm, or for a crate directory what `voidhash test` wrote to
//     target/voidhash/module.wasm, or the release build at
//     target/wasm32-unknown-unknown/release/<crate>.wasm in the crate or its
//     workspace one level up;
//   - panel.wasm or target/voidhash/panel.wasm, the editor panel module,
//     which a module that declares a panel needs;
//   - optional icon.(png|svg|webp), thumbnails/<state>.(png|jpg|webp),
//     README.md and agent.md.
//
// The server runs every publish check. The panel module is checked here too,
// so a panel the server would refuse fails before anything is uploaded. A
// problem with the bundle is a [*BundleError]. It also returns the path of
// the module it took.
func ReadBundle(directory string) (*Bundle, string, error) {
	file := func(name string) string { return filepath.Join(directory, name) }

	definitionText, err := optionalText(file("component.json"))
	if err != nil {
		return nil, "", err
	}
	if definitionText == nil {
		return nil, "", &BundleError{
			Message: file("component.json") + " not found. A bundle needs component.json, the definition to publish.",
			Hint:    "Or publish a ready project component with --from-project <slug>@<version>.",
		}
	}

	buildOutput := filepath.Join(directory, BuildOutputPath)
	modulePath := ""
	switch {
	case exists(file("module.wasm")):
		modulePath = file("module.wasm")
	case exists(filepath.Join(buildOutput, "module.wasm")):
		modulePath = filepath.Join(buildOutput, "module.wasm")
	default:
		cargoToml, err := optionalText(file("Cargo.toml"))
		if err != nil {
			return nil, "", err
		}
		if cargoToml != nil {
			if name := PackageName(*cargoToml); name != "" {
				// A crate builds into its own target directory, or its workspace's one level up.
				for _, root := range []string{directory, filepath.Join(directory, "..")} {
					candidate := filepath.Join(root, "target", wasmTarget, "release", WasmFileName(name))
					if modulePath == "" && exists(candidate) {
						modulePath = candidate
					}
				}
			}
		}
		if modulePath == "" {
			return nil, "", &BundleError{
				Message: "No module found in " + directory + ".",
				Hint:    "Build it with 'voidhash test', or put module.wasm next to component.json.",
			}
		}
	}

	panelPath := ""
	for _, candidate := range []string{file("panel.wasm"), filepath.Join(buildOutput, "panel.wasm")} {
		if panelPath == "" && exists(candidate) {
			panelPath = candidate
		}
	}
	module, err := os.ReadFile(modulePath)
	if err != nil {
		return nil, "", err
	}
	described, err := definition.ReadModule(module)
	if err != nil {
		return nil, "", &BundleError{Message: modulePath + ": " + err.Error()}
	}
	bundle := &Bundle{
		DefinitionJSON: *definitionText,
		ModuleBase64:   base64.StdEncoding.EncodeToString(module),
		Thumbnails:     []BundleThumbnail{},
	}
	if panelPath == "" && described.Panel {
		return nil, "", &BundleError{
			Message: fmt.Sprintf("%s declares an editor panel, but %s has no panel.wasm.", described.ID, directory),
			Hint:    "Build both modules with 'voidhash test'.",
		}
	}
	if panelPath != "" {
		panel, err := os.ReadFile(panelPath)
		if err != nil {
			return nil, "", err
		}
		if _, problems := definition.ValidatePanelModule(panel, described); len(problems) > 0 {
			return nil, "", &BundleError{
				Message: strings.Join(append([]string{panelPath + " did not pass the panel checks:"}, problems...), "\n  - "),
			}
		}
		encoded := base64.StdEncoding.EncodeToString(panel)
		bundle.PanelBase64 = &encoded
	}

	entries, err := os.ReadDir(directory)
	if err != nil {
		return nil, "", err
	}
	for _, entry := range entries {
		if bundle.Icon != nil || !iconPattern.MatchString(entry.Name()) {
			continue
		}
		icon, err := os.ReadFile(file(entry.Name()))
		if err != nil {
			return nil, "", err
		}
		bundle.Icon = &BundleFile{Base64: base64.StdEncoding.EncodeToString(icon), ContentType: BundleImageType(entry.Name())}
	}
	thumbnails, err := os.ReadDir(file("thumbnails"))
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, "", err
	}
	for _, entry := range thumbnails {
		name := entry.Name()
		contentType := BundleImageType(name)
		if contentType == "" {
			continue
		}
		image, err := os.ReadFile(filepath.Join(file("thumbnails"), name))
		if err != nil {
			return nil, "", err
		}
		bundle.Thumbnails = append(bundle.Thumbnails, BundleThumbnail{
			State:       name[:strings.LastIndex(name, ".")],
			Base64:      base64.StdEncoding.EncodeToString(image),
			ContentType: contentType,
		})
	}
	if bundle.Readme, err = optionalText(file("README.md")); err != nil {
		return nil, "", err
	}
	if bundle.AgentGuide, err = optionalText(file("agent.md")); err != nil {
		return nil, "", err
	}
	return bundle, modulePath, nil
}

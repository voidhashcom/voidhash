package initcmd

import (
	"os"
	"path"
	"path/filepath"
	"strings"
)

// What kind of app a directory holds decides what `voidhash init` writes
// besides voidhash.json: a JavaScript project gets the React Native client
// and TypeScript declarations, an Xcode project or Swift package Swift
// types, a Gradle project Kotlin types.

const typesBaseName = "VoidhashTypes"

func exists(dir string, names ...string) bool {
	for _, name := range names {
		if _, err := os.Stat(filepath.Join(dir, name)); err == nil {
			return true
		}
	}
	return false
}

// directories lists the names of dir's subdirectories, without hidden ones.
func directories(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var names []string
	for _, entry := range entries {
		if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") {
			names = append(names, entry.Name())
		}
	}
	return names
}

// isJavaScriptProject reports whether dir has a package.json.
func isJavaScriptProject(dir string) bool { return exists(dir, "package.json") }

// usesTypeScript reports whether a JavaScript project is written in
// TypeScript, by its tsconfig.json.
func usesTypeScript(dir string) bool { return exists(dir, "tsconfig.json") }

// clientFile is where the SDK client is scaffolded: src/lib when the
// project has a src directory, else lib, in the project's language.
func clientFile(dir string) string {
	name := "voidhash.js"
	if usesTypeScript(dir) {
		name = "voidhash.ts"
	}
	if info, err := os.Stat(filepath.Join(dir, "src")); err == nil && info.IsDir() {
		return path.Join("src", "lib", name)
	}
	return path.Join("lib", name)
}

// SwiftProject describes the Swift project in dir, "a Swift package" or
// "an Xcode project", and where its types file goes by default. found is
// false when dir holds neither.
func SwiftProject(dir string) (what, output string, found bool) {
	if exists(dir, "Package.swift") {
		// A package with one target keeps the file with its sources.
		if targets := directories(filepath.Join(dir, "Sources")); len(targets) == 1 {
			return "a Swift package", path.Join("Sources", targets[0], typesBaseName+".swift"), true
		}
		return "a Swift package", typesBaseName + ".swift", true
	}
	for _, name := range directories(dir) {
		project, isProject := strings.CutSuffix(name, ".xcodeproj")
		if !isProject {
			project, isProject = strings.CutSuffix(name, ".xcworkspace")
		}
		if !isProject {
			continue
		}
		// Xcode keeps an app's sources in a folder named like the project.
		if info, err := os.Stat(filepath.Join(dir, project)); err == nil && info.IsDir() {
			return "an Xcode project", path.Join(project, typesBaseName+".swift"), true
		}
		return "an Xcode project", typesBaseName + ".swift", true
	}
	return "", "", false
}

// GradleProject reports whether dir is a Gradle project, and where its
// Kotlin types file goes by default: in the package directory of the app
// module's sources when there is one such directory.
func GradleProject(dir string) (output string, found bool) {
	if !exists(dir, "build.gradle.kts", "build.gradle", "settings.gradle.kts", "settings.gradle") {
		return "", false
	}
	for _, module := range []string{"app", "."} {
		for _, sources := range []string{"kotlin", "java"} {
			root := path.Join(module, "src", "main", sources)
			if info, err := os.Stat(filepath.Join(dir, filepath.FromSlash(root))); err != nil || !info.IsDir() {
				continue
			}
			// com/acme/app: follow the directories while there is one way down.
			for {
				entries, err := os.ReadDir(filepath.Join(dir, filepath.FromSlash(root)))
				if err != nil || len(entries) != 1 || !entries[0].IsDir() {
					break
				}
				root = path.Join(root, entries[0].Name())
			}
			return path.Join(root, typesBaseName+".kt"), true
		}
	}
	return typesBaseName + ".kt", true
}

// Package wasm reads the structure of a WebAssembly binary: what a module
// imports and exports, the signatures of its functions, and its custom
// sections. It reads section headers and the type, import, function and
// export sections only; it does not validate code.
package wasm

import (
	"fmt"
	"unicode/utf8"
)

// Binary codes of the value types a signature can name.
const (
	I32 byte = 0x7f
	I64 byte = 0x7e
	F32 byte = 0x7d
	F64 byte = 0x7c
)

// Kind is what an import or export is.
type Kind string

// The kinds of imports and exports.
const (
	Function Kind = "function"
	Table    Kind = "table"
	Memory   Kind = "memory"
	Global   Kind = "global"
	Tag      Kind = "tag"
)

var kinds = []Kind{Function, Table, Memory, Global, Tag}

// FunctionType is a function signature, with value types as their binary
// codes.
type FunctionType struct {
	Params  []byte
	Results []byte
}

// Import is one import of a module.
type Import struct {
	Module string
	Name   string
	Kind   Kind
	// Type is the type index of an imported function, and -1 for the rest.
	Type int
}

// Export is one export of a module.
type Export struct {
	Name  string
	Kind  Kind
	Index int
}

// CustomSection is a named section the WebAssembly runtime ignores.
type CustomSection struct {
	Name    string
	Payload []byte
}

// Module is the structure of a WebAssembly binary.
type Module struct {
	Types   []FunctionType
	Imports []Import
	// Functions holds the type index of each function the module defines,
	// after the imported ones.
	Functions      []int
	Exports        []Export
	CustomSections []CustomSection
	HasStart       bool
}

var header = []byte{0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00}

type malformed string

// Read reads data as a version 1 WebAssembly module. The error is a
// sentence saying why it is not one.
func Read(data []byte) (module *Module, err error) {
	if len(data) < 8 || string(data[:8]) != string(header) {
		return nil, fmt.Errorf("The file is not a version 1 WebAssembly module.")
	}
	defer func() {
		if recovered := recover(); recovered != nil {
			reason, ok := recovered.(malformed)
			if !ok {
				panic(recovered)
			}
			module, err = nil, fmt.Errorf("The module is malformed: %s", string(reason))
		}
	}()
	return (&reader{data: data, offset: 8, end: len(data)}).sections(), nil
}

// ExportedFunctionType is the signature of the exported function name;
// ok is false when the module exports no such function.
func (m *Module) ExportedFunctionType(name string) (FunctionType, bool) {
	for _, entry := range m.Exports {
		if entry.Name != name {
			continue
		}
		if entry.Kind != Function {
			return FunctionType{}, false
		}
		var imported []Import
		for _, candidate := range m.Imports {
			if candidate.Kind == Function {
				imported = append(imported, candidate)
			}
		}
		typeIndex := -1
		if entry.Index < len(imported) {
			typeIndex = imported[entry.Index].Type
		} else if defined := entry.Index - len(imported); defined < len(m.Functions) {
			typeIndex = m.Functions[defined]
		}
		if typeIndex < 0 || typeIndex >= len(m.Types) {
			return FunctionType{}, false
		}
		return m.Types[typeIndex], true
	}
	return FunctionType{}, false
}

type reader struct {
	data   []byte
	offset int
	end    int
}

func fail(format string, args ...any) {
	panic(malformed(fmt.Sprintf(format, args...)))
}

func (r *reader) byte() byte {
	if r.offset >= r.end {
		fail("it ends inside a section.")
	}
	value := r.data[r.offset]
	r.offset++
	return value
}

// leb reads an unsigned LEB128 number of at most bits bits.
func (r *reader) leb(bits int) int {
	result := uint64(0)
	for read := 0; read*7 < bits; read++ {
		next := r.byte()
		result |= uint64(next&0x7f) << (7 * read)
		if next&0x80 == 0 {
			// A count or size past what a slice holds cannot be met by the
			// bytes that follow; the caller's bounds check reports it.
			if result > 1<<62 {
				return 1 << 62
			}
			return int(result)
		}
	}
	fail("a number is too long.")
	return 0
}

func (r *reader) name() string {
	length := r.leb(32)
	if length > r.end-r.offset {
		fail("a name runs past its section.")
	}
	start := r.offset
	r.offset += length
	text := r.data[start:r.offset]
	if !utf8.Valid(text) {
		fail("a name is not UTF-8.")
	}
	return string(text)
}

// count reads the length of a vector, whose items take at least a byte each.
func (r *reader) count() int {
	length := r.leb(32)
	if length > r.end-r.offset {
		fail("it ends inside a section.")
	}
	return length
}

func (r *reader) valueType() byte {
	code := r.byte()
	switch code {
	case 0x7f, 0x7e, 0x7d, 0x7c, 0x7b, 0x70, 0x6f:
		return code
	}
	fail("value type 0x%x is not supported.", code)
	return 0
}

func (r *reader) valueTypes() []byte {
	types := make([]byte, r.count())
	for index := range types {
		types[index] = r.valueType()
	}
	return types
}

func (r *reader) limits() {
	flags := r.byte()
	bits := 32
	if flags&0x04 != 0 {
		bits = 64
	}
	r.leb(bits)
	if flags&0x01 != 0 {
		r.leb(bits)
	}
}

func (r *reader) kind() Kind {
	code := r.byte()
	if int(code) >= len(kinds) {
		fail("external kind %d is unknown.", code)
	}
	return kinds[code]
}

func (r *reader) sections() *Module {
	module := &Module{}
	for r.offset < len(r.data) {
		r.end = len(r.data)
		id := r.byte()
		size := r.leb(32)
		if size > len(r.data)-r.offset {
			fail("section %d runs past the end.", id)
		}
		sectionEnd := r.offset + size
		r.end = sectionEnd
		switch id {
		case 0:
			name := r.name()
			module.CustomSections = append(module.CustomSections, CustomSection{Name: name, Payload: r.data[r.offset:sectionEnd]})
			r.offset = sectionEnd
		case 1:
			for remaining := r.count(); remaining > 0; remaining-- {
				if form := r.byte(); form != 0x60 {
					fail("type form 0x%x is not supported.", form)
				}
				params := r.valueTypes()
				module.Types = append(module.Types, FunctionType{Params: params, Results: r.valueTypes()})
			}
		case 2:
			for remaining := r.count(); remaining > 0; remaining-- {
				entry := Import{Module: r.name(), Type: -1}
				entry.Name = r.name()
				entry.Kind = r.kind()
				switch entry.Kind {
				case Function:
					entry.Type = r.leb(32)
				case Table:
					r.byte()
					r.limits()
				case Memory:
					r.limits()
				case Global:
					r.valueType()
					r.byte()
				default:
					r.byte()
					r.leb(32)
				}
				module.Imports = append(module.Imports, entry)
			}
		case 3:
			for remaining := r.count(); remaining > 0; remaining-- {
				module.Functions = append(module.Functions, r.leb(32))
			}
		case 7:
			for remaining := r.count(); remaining > 0; remaining-- {
				entry := Export{Name: r.name()}
				entry.Kind = r.kind()
				entry.Index = r.leb(32)
				module.Exports = append(module.Exports, entry)
			}
		case 8:
			module.HasStart = true
			r.offset = sectionEnd
		default:
			if id > 13 {
				fail("section id %d is unknown.", id)
			}
			r.offset = sectionEnd
		}
		if r.offset != sectionEnd {
			fail("section %d has trailing bytes.", id)
		}
	}
	return module
}

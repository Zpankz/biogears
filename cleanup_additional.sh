#!/bin/bash

# Additional cleanup script to reduce BioGears repository to core physiology engine
# Target: <= 100MB repository focused on macOS C++ development
# Removes documentation, validation data, examples, and external dependencies

echo "Starting additional BioGears cleanup for core physiology engine focus..."
echo "Target: Reduce repository to <= 100MB"

# Track initial size
INITIAL_SIZE=$(du -sh . | cut -f1)
echo "Initial repository size: $INITIAL_SIZE"

# --- Phase 1: Remove Documentation (350MB) ---
echo ""
echo "Phase 1: Removing documentation and generated docs..."

# Remove validation documentation (276MB)
if [ -d "share/doc/validation" ]; then
    echo "Removing validation documentation: share/doc/validation/ (276MB)"
    rm -rf "share/doc/validation"
fi

# Remove generated doxygen documentation (66MB)  
if [ -d "share/doc/doxygen" ]; then
    echo "Removing doxygen documentation: share/doc/doxygen/ (66MB)"
    rm -rf "share/doc/doxygen"
fi

# Remove working documents (6MB)
if [ -d "share/doc/working" ]; then
    echo "Removing working documents: share/doc/working/ (6MB)" 
    rm -rf "share/doc/working"
fi

# Remove methodology documentation (1.3MB)
if [ -d "share/doc/methodology" ]; then
    echo "Removing methodology documentation: share/doc/methodology/ (1.3MB)"
    rm -rf "share/doc/methodology"
fi

# Remove markdown docs (308KB)
if [ -d "share/doc/markdown" ]; then
    echo "Removing markdown documentation: share/doc/markdown/ (308KB)"
    rm -rf "share/doc/markdown" 
fi

# Remove doxygen config (32KB)
if [ -f "share/doc/cmake-common.doxy" ]; then
    echo "Removing doxygen config: share/doc/cmake-common.doxy"
    rm -f "share/doc/cmake-common.doxy"
fi

# --- Phase 2: Remove Test/Validation Data (64MB) ---
echo ""
echo "Phase 2: Removing test and validation data..."

# Remove validation test data (28MB)
if [ -d "share/data/validation" ]; then
    echo "Removing validation test data: share/data/validation/ (28MB)"
    rm -rf "share/data/validation"
fi

# Remove saved simulation states (36MB)
if [ -d "share/data/states" ]; then
    echo "Removing simulation states: share/data/states/ (36MB)"
    rm -rf "share/data/states"
fi

# Remove docs subfolder (548KB)
if [ -d "share/data/docs" ]; then
    echo "Removing data docs: share/data/docs/ (548KB)"
    rm -rf "share/data/docs"
fi

# --- Phase 3: Remove Website Generation (6.8MB) ---
echo ""
echo "Phase 3: Removing website generation files..."

if [ -d "share/website" ]; then
    echo "Removing website files: share/website/ (6.8MB)"
    rm -rf "share/website"
fi

if [ -d "projects/website" ]; then
    echo "Removing website project: projects/website/ (116KB)"
    rm -rf "projects/website"
fi

# --- Phase 4: Remove External Dependencies (5.6MB) ---
echo ""
echo "Phase 4: Removing external ZIP library dependency..."

if [ -d "projects/zip" ]; then
    echo "Removing ZIP library: projects/zip/ (5.6MB)"
    rm -rf "projects/zip"
fi

# --- Phase 5: Remove Scenarios (4.4MB) ---
echo ""
echo "Phase 5: Removing simulation scenarios..."

if [ -d "share/Scenarios" ]; then
    echo "Removing scenarios: share/Scenarios/ (4.4MB)"
    rm -rf "share/Scenarios"
fi

# --- Phase 6: Remove Example/Tutorial Projects (2MB+) ---
echo ""
echo "Phase 6: Removing example and tutorial projects..."

if [ -d "projects/howto" ]; then
    echo "Removing howto examples: projects/howto/ (2MB)"
    rm -rf "projects/howto"
fi

if [ -d "projects/cli" ]; then
    echo "Removing CLI project: projects/cli/ (740KB)"  
    rm -rf "projects/cli"
fi

if [ -d "projects/circuit_profiler" ]; then
    echo "Removing circuit profiler: projects/circuit_profiler/ (68KB)"
    rm -rf "projects/circuit_profiler"
fi

if [ -d "projects/test_driver" ]; then
    echo "Removing test driver: projects/test_driver/ (48KB)"
    rm -rf "projects/test_driver"
fi

if [ -d "projects/papers" ]; then
    echo "Removing papers: projects/papers/ (228KB)"
    rm -rf "projects/papers"
fi

# --- Phase 7: Remove SWIG Language Bindings (1.3MB) ---
echo ""
echo "Phase 7: Removing SWIG language bindings..."

if [ -d "projects/biogears/swig_bindings" ]; then
    echo "Removing SWIG bindings: projects/biogears/swig_bindings/ (1.3MB)"
    rm -rf "projects/biogears/swig_bindings"
fi

# --- Phase 8: Remove Python Scripts (36KB) ---
echo ""
echo "Phase 8: Removing Python utilities..."

if [ -d "share/python" ]; then
    echo "Removing Python scripts: share/python/ (36KB)"
    rm -rf "share/python"
fi

# --- Phase 9: Remove Development Tools ---
echo ""
echo "Phase 9: Removing development configuration tools..."

# Remove astyle configuration
if [ -d "share/astyle" ]; then
    echo "Removing astyle config: share/astyle/"
    rm -rf "share/astyle"
fi

# Remove clang-format share config (keep root .clang-format)
if [ -d "share/clang-format" ]; then
    echo "Removing clang-format share config: share/clang-format/"
    rm -rf "share/clang-format"
fi

# Remove protocol buffers (36KB)
if [ -d "share/proto" ]; then
    echo "Removing protobuf files: share/proto/ (36KB)"
    rm -rf "share/proto"
fi

# Remove XSD schemas (464KB)
if [ -d "share/xsd" ]; then
    echo "Removing XSD schemas: share/xsd/ (464KB)"
    rm -rf "share/xsd"
fi

# --- Phase 10: Clean up empty directories ---
echo ""
echo "Phase 10: Cleaning up empty directories..."

# Remove share/doc if now empty
if [ -d "share/doc" ] && [ -z "$(ls -A share/doc)" ]; then
    echo "Removing empty share/doc directory"
    rmdir "share/doc"
fi

# Calculate final size
echo ""
FINAL_SIZE=$(du -sh . | cut -f1)
FILE_COUNT=$(find . -type f | wc -l)

echo "=== CLEANUP COMPLETE ==="
echo "Initial size: $INITIAL_SIZE"
echo "Final size: $FINAL_SIZE"
echo "Total files: $FILE_COUNT"
echo ""
echo "Repository now contains only:"
echo "- Core BioGears physiology engine (libBiogears)"
echo "- Common Data Model (libCDM)" 
echo "- I/O utilities (libIO)"
echo "- Essential configuration and patient data"
echo "- Build system (CMake files)"
echo "- License and core documentation"
echo ""
echo "Removed components:"
echo "- Documentation and validation reports (350MB+)"
echo "- Test/validation datasets (64MB)"
echo "- Website generation (6.8MB)"
echo "- External ZIP dependency (5.6MB)"
echo "- Example projects and tutorials (2MB+)"
echo "- SWIG language bindings (1.3MB)"
echo "- Python utilities and development tools"
echo ""

if [[ "$FINAL_SIZE" =~ ^[0-9]+M$ ]] && [[ "${FINAL_SIZE%M}" -le 100 ]]; then
    echo "✅ SUCCESS: Repository size is now <= 100MB"
else
    echo "⚠️  Repository size may still be > 100MB. Additional cleanup may be needed."
fi
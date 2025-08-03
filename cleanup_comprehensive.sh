#!/bin/bash

# Comprehensive BioGears repository cleanup script for macOS C++ focus
# Removes Java/GUI components, documentation, tests, and non-essential components
# Target: Create a lean repository focused on the core physiology engine (<= 100MB)

echo "=========================================="
echo "BioGears Repository Comprehensive Cleanup"
echo "Target: macOS C++ physiology engine focus"
echo "Goal: <= 100MB repository size"
echo "=========================================="

# Track initial size
INITIAL_SIZE=$(du -sh . | cut -f1)
INITIAL_FILES=$(find . -type f | wc -l)
echo "Initial repository size: $INITIAL_SIZE ($INITIAL_FILES files)"
echo ""

# --- Phase 1: Remove Java/GUI Components ---
echo "Phase 1: Removing Java/GUI components and build artifacts..."

# Remove GUI source code
if [ -d "src/gui" ]; then
    echo "• Removing GUI source directory: src/gui/"
    rm -rf "src/gui"
fi

# Remove Java-related projects and files
echo "• Removing Java source files and Eclipse project files..."
find . -type f \( -name "*.java" -o -name ".project" -o -name ".classpath" \) -print -delete

# Remove SWIG not_implemented bindings
echo "• Removing SWIG not_implemented bindings..."
find . -path "*/swig_bindings/not_implemented*" -type f -print -delete

# Remove Docker configurations
echo "• Removing Docker configurations..."
rm -f docker-compose.yml
find . -name "Dockerfile*" -type f -print -delete

# Remove cross-platform toolchains
echo "• Removing non-macOS CMake toolchain files..."
find . -name "*toolchain*" -not -path "./cmake/toolchains/apple*" -type f -print -delete

# Remove platform-specific build artifacts
echo "• Removing platform-specific build artifacts..."
find . -name "*.bat" -type f -print -delete
find . -name "*-linux*" -o -name "*-win*" -type f -print -delete

# --- Phase 2: Remove Documentation (350MB+) ---
echo ""
echo "Phase 2: Removing documentation and generated docs..."

if [ -d "share/doc/validation" ]; then
    echo "• Removing validation documentation (276MB)"
    rm -rf "share/doc/validation"
fi

if [ -d "share/doc/doxygen" ]; then
    echo "• Removing doxygen documentation (66MB)"
    rm -rf "share/doc/doxygen"
fi

if [ -d "share/doc/working" ]; then
    echo "• Removing working documents (6MB)"
    rm -rf "share/doc/working"
fi

if [ -d "share/doc/methodology" ]; then
    echo "• Removing methodology documentation (1.3MB)"
    rm -rf "share/doc/methodology"
fi

if [ -d "share/doc/markdown" ]; then
    echo "• Removing markdown documentation (308KB)"
    rm -rf "share/doc/markdown"
fi

# --- Phase 3: Remove Test/Validation Data (64MB+) ---
echo ""
echo "Phase 3: Removing test and validation data..."

if [ -d "share/data/validation" ]; then
    echo "• Removing validation test data (28MB)"
    rm -rf "share/data/validation"
fi

if [ -d "share/data/states" ]; then
    echo "• Removing simulation states (36MB)"
    rm -rf "share/data/states"
fi

if [ -d "share/data/docs" ]; then
    echo "• Removing data docs (548KB)"
    rm -rf "share/data/docs"
fi

# --- Phase 4: Remove Website/Examples (10MB+) ---
echo ""
echo "Phase 4: Removing website and example projects..."

if [ -d "share/website" ]; then
    echo "• Removing website files (6.8MB)"
    rm -rf "share/website"
fi

if [ -d "projects/website" ]; then
    echo "• Removing website project (116KB)"
    rm -rf "projects/website"
fi

if [ -d "projects/howto" ]; then
    echo "• Removing howto examples (2MB)"
    rm -rf "projects/howto"
fi

if [ -d "projects/cli" ]; then
    echo "• Removing CLI project (740KB)"
    rm -rf "projects/cli"
fi

if [ -d "projects/papers" ]; then
    echo "• Removing papers (228KB)"
    rm -rf "projects/papers"
fi

# --- Phase 5: Remove External Dependencies (5.6MB) ---
echo ""
echo "Phase 5: Removing external dependencies..."

if [ -d "projects/zip" ]; then
    echo "• Removing ZIP library (5.6MB)"
    rm -rf "projects/zip"
fi

# --- Phase 6: Remove Scenarios and Development Tools ---
echo ""
echo "Phase 6: Removing scenarios and development tools..."

if [ -d "share/Scenarios" ]; then
    echo "• Removing scenarios (4.4MB)"
    rm -rf "share/Scenarios"
fi

if [ -d "share/python" ]; then
    echo "• Removing Python scripts (36KB)"
    rm -rf "share/python"
fi

if [ -d "share/astyle" ]; then
    echo "• Removing astyle config"
    rm -rf "share/astyle"
fi

if [ -d "share/clang-format" ]; then
    echo "• Removing clang-format share config"
    rm -rf "share/clang-format"
fi

if [ -d "share/proto" ]; then
    echo "• Removing protobuf files (36KB)"
    rm -rf "share/proto"
fi

if [ -d "share/xsd" ]; then
    echo "• Removing XSD schemas (464KB)"
    rm -rf "share/xsd"
fi

# --- Phase 7: Remove Test Components (12MB+) ---
echo ""
echo "Phase 7: Removing test components and frameworks..."

if [ -d "projects/biogears/libBiogears/unit" ]; then
    echo "• Removing libBiogears unit tests (11MB)"
    rm -rf "projects/biogears/libBiogears/unit"
fi

if [ -d "projects/biogears/libCircuitTest" ]; then
    echo "• Removing circuit test library (1.3MB)"
    rm -rf "projects/biogears/libCircuitTest"
fi

if [ -d "projects/unit" ]; then
    echo "• Removing unit test project (28KB)"
    rm -rf "projects/unit"
fi

if [ -d "projects/circuit_profiler" ]; then
    echo "• Removing circuit profiler (68KB)"
    rm -rf "projects/circuit_profiler"
fi

if [ -d "projects/test_driver" ]; then
    echo "• Removing test driver (48KB)"
    rm -rf "projects/test_driver"
fi

# --- Phase 8: Remove SWIG Language Bindings ---
echo ""
echo "Phase 8: Removing language bindings..."

if [ -d "projects/biogears/swig_bindings" ]; then
    echo "• Removing SWIG bindings (1.3MB)"
    rm -rf "projects/biogears/swig_bindings"
fi

# --- Phase 9: Remove Non-Essential Data ---
echo ""
echo "Phase 9: Removing non-essential data files..."

if [ -d "share/data/templates" ]; then
    echo "• Removing data templates (296KB)"
    rm -rf "share/data/templates"
fi

# --- Phase 10: Clean up empty directories ---
echo ""
echo "Phase 10: Cleaning up empty directories..."

find . -type d -empty -delete 2>/dev/null

# Calculate final size
echo ""
echo "=========================================="
echo "CLEANUP COMPLETE"
echo "=========================================="

FINAL_SIZE=$(du -sh . | cut -f1)
FINAL_FILES=$(find . -type f | wc -l)
REMOVED_FILES=$((INITIAL_FILES - FINAL_FILES))

echo "Initial size: $INITIAL_SIZE ($INITIAL_FILES files)"
echo "Final size: $FINAL_SIZE ($FINAL_FILES files)"
echo "Removed: $REMOVED_FILES files"
echo ""

# Check if we reached the target
if [[ "$FINAL_SIZE" =~ ^[0-9]+M$ ]] && [[ "${FINAL_SIZE%M}" -le 100 ]]; then
    echo "✅ SUCCESS: Repository size is now <= 100MB"
else
    echo "⚠️  Repository size: $FINAL_SIZE (target was <= 100MB)"
fi

echo ""
echo "Production-ready repository contains:"
echo "• Core BioGears physiology engine (libBiogears/src + include)"
echo "• Common Data Model (libCDM)"
echo "• I/O utilities (libIO)"
echo "• Essential patient and substance data"
echo "• Core configuration files"
echo "• CMake build system for macOS"
echo ""
echo "Removed components:"
echo "• Documentation and validation reports (350MB+)"
echo "• Test frameworks and unit tests (12MB+)"
echo "• Test/validation datasets (64MB)"
echo "• Example projects and tutorials (10MB+)"
echo "• External dependencies (5.6MB)"
echo "• Language bindings and development tools"
echo "• Platform-specific build artifacts"
echo ""
echo "Next steps:"
echo "1. Review CMakeLists.txt files for any broken references"
echo "2. Test build: cmake -S . -B build -DCMAKE_BUILD_TYPE=Release"
echo "3. Verify core C++ targets build successfully"
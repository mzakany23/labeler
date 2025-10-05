"""
Configuration models for domain-agnostic data labeling
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class CleaningPattern(BaseModel):
    """Configuration for text cleaning patterns"""
    pattern: str = Field(..., description="Regex pattern to match")
    replacement: str = Field("", description="Replacement string")
    description: Optional[str] = Field(None, description="Description of what this pattern does")


class DomainConfiguration(BaseModel):
    """Domain-specific configuration for data processing"""
    domain_name: str = Field(..., description="Name of the data domain (e.g., 'financial', 'medical', 'ecommerce')")
    description: Optional[str] = Field(None, description="Description of this domain configuration")

    # Text cleaning configuration
    cleaning_patterns: List[CleaningPattern] = Field(default_factory=list, description="Patterns for cleaning text fields")

    # Field mapping configuration (what columns represent what)
    field_mappings: Dict[str, str] = Field(default_factory=dict, description="Mapping of generic field names to domain-specific meanings")

    # Validation rules
    validation_rules: Dict[str, Any] = Field(default_factory=dict, description="Domain-specific validation rules")

    # Pattern extraction rules
    entity_patterns: Dict[str, List[str]] = Field(default_factory=dict, description="Patterns for extracting entities (merchant, category, etc.)")

    is_active: bool = Field(True, description="Whether this configuration is active")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ConfigurationManager:
    """Manages domain configurations"""

    def __init__(self):
        self.configs: Dict[str, DomainConfiguration] = {}

    def add_config(self, config: DomainConfiguration) -> DomainConfiguration:
        """Add a domain configuration"""
        self.configs[config.domain_name] = config
        return config

    def get_config(self, domain_name: str) -> Optional[DomainConfiguration]:
        """Get configuration for a domain"""
        return self.configs.get(domain_name)

    def list_configs(self) -> List[DomainConfiguration]:
        """List all configurations"""
        return list(self.configs.values())

    def get_active_config(self) -> Optional[DomainConfiguration]:
        """Get the currently active configuration"""
        active = [config for config in self.configs.values() if config.is_active]
        return active[0] if active else None


# Global configuration manager
config_manager = ConfigurationManager()

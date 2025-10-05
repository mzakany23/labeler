"""
Configuration API for domain-agnostic data labeling
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import logging

from ..models.configuration import (
    DomainConfiguration, CleaningPattern, config_manager
)
from ..models.merchant_patterns import MerchantPattern, MerchantPatternCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/configuration", tags=["Configuration"])


@router.post("/domains", response_model=DomainConfiguration)
async def create_domain_config(config: DomainConfiguration):
    """
    Create a new domain configuration

    - **config**: Domain configuration data
    """
    try:
        saved_config = config_manager.add_config(config)
        logger.info(f"Created domain configuration: {config.domain_name}")
        return saved_config
    except Exception as e:
        logger.error(f"Error creating domain configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create configuration: {str(e)}")


@router.get("/domains", response_model=List[DomainConfiguration])
async def list_domain_configs():
    """
    List all domain configurations
    """
    try:
        configs = config_manager.list_configs()
        return configs
    except Exception as e:
        logger.error(f"Error listing domain configurations: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list configurations: {str(e)}")


@router.get("/domains/{domain_name}", response_model=DomainConfiguration)
async def get_domain_config(domain_name: str):
    """
    Get a specific domain configuration

    - **domain_name**: Name of the domain configuration
    """
    try:
        config = config_manager.get_config(domain_name)
        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")

        return config
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting domain configuration {domain_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get configuration: {str(e)}")


@router.put("/domains/{domain_name}", response_model=DomainConfiguration)
async def update_domain_config(domain_name: str, config: DomainConfiguration):
    """
    Update a domain configuration

    - **domain_name**: Name of the domain configuration
    - **config**: Updated configuration data
    """
    try:
        # Get existing config
        existing = config_manager.get_config(domain_name)
        if not existing:
            raise HTTPException(status_code=404, detail="Configuration not found")

        # Update fields
        for field, value in config.dict(exclude={'domain_name'}).items():
            setattr(existing, field, value)

        logger.info(f"Updated domain configuration: {domain_name}")
        return existing
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating domain configuration {domain_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update configuration: {str(e)}")


@router.delete("/domains/{domain_name}")
async def delete_domain_config(domain_name: str):
    """
    Delete a domain configuration

    - **domain_name**: Name of the domain configuration
    """
    try:
        # For now, just mark as inactive rather than deleting
        config = config_manager.get_config(domain_name)
        if config:
            config.is_active = False
            logger.info(f"Deactivated domain configuration: {domain_name}")
            return {"message": "Configuration deactivated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Configuration not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting domain configuration {domain_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete configuration: {str(e)}")


@router.post("/domains/{domain_name}/activate")
async def activate_domain_config(domain_name: str):
    """
    Activate a domain configuration (deactivate others)

    - **domain_name**: Name of the domain configuration to activate
    """
    try:
        config = config_manager.get_config(domain_name)
        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")

        # Deactivate all others
        for other_config in config_manager.list_configs():
            other_config.is_active = False

        # Activate this one
        config.is_active = True

        logger.info(f"Activated domain configuration: {domain_name}")
        return {"message": f"Activated configuration: {domain_name}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating domain configuration {domain_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to activate configuration: {str(e)}")


@router.get("/domains/active", response_model=Optional[DomainConfiguration])
async def get_active_domain_config():
    """
    Get the currently active domain configuration
    """
    try:
        config = config_manager.get_active_config()
        return config
    except Exception as e:
        logger.error(f"Error getting active configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get active configuration: {str(e)}")


@router.post("/domains/{domain_name}/patterns")
async def add_cleaning_pattern(
    domain_name: str,
    pattern: CleaningPattern
):
    """
    Add a cleaning pattern to a domain configuration

    - **domain_name**: Name of the domain configuration
    - **pattern**: Cleaning pattern to add
    """
    try:
        config = config_manager.get_config(domain_name)
        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")

        config.cleaning_patterns.append(pattern)
        logger.info(f"Added cleaning pattern to domain {domain_name}")
        return {"message": "Pattern added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding pattern to domain {domain_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add pattern: {str(e)}")


@router.delete("/domains/{domain_name}/patterns/{pattern_index}")
async def remove_cleaning_pattern(domain_name: str, pattern_index: int):
    """
    Remove a cleaning pattern from a domain configuration

    - **domain_name**: Name of the domain configuration
    - **pattern_index**: Index of the pattern to remove
    """
    try:
        config = config_manager.get_config(domain_name)
        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")

        if 0 <= pattern_index < len(config.cleaning_patterns):
            removed = config.cleaning_patterns.pop(pattern_index)
            logger.info(f"Removed cleaning pattern from domain {domain_name}")
            return {"message": "Pattern removed successfully", "removed_pattern": removed}
        else:
            raise HTTPException(status_code=404, detail="Pattern index not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing pattern from domain {domain_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove pattern: {str(e)}")


@router.post("/domains/{domain_name}/merchant-patterns")
async def add_merchant_pattern_to_domain(
    domain_name: str,
    pattern: MerchantPatternCreate
):
    """
    Add a merchant pattern to a domain configuration

    - **domain_name**: Name of the domain configuration
    - **pattern**: Merchant pattern to add
    """
    try:
        # Create the pattern in the pattern manager
        from ..services.merchant_patterns import pattern_manager
        merchant_pattern = pattern_manager.create_pattern(pattern)

        # Add to domain configuration
        config = config_manager.get_config(domain_name)
        if not config:
            raise HTTPException(status_code=404, detail="Configuration not found")

        if 'merchant' not in config.entity_patterns:
            config.entity_patterns['merchant'] = []

        config.entity_patterns['merchant'].append(merchant_pattern.pattern)

        logger.info(f"Added merchant pattern to domain {domain_name}")
        return {
            "message": "Merchant pattern added successfully",
            "pattern_id": merchant_pattern.id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding merchant pattern to domain {domain_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add merchant pattern: {str(e)}")


@router.get("/test-cleaning")
async def test_cleaning_patterns(
    text: str = Query(..., description="Text to clean"),
    domain_name: Optional[str] = Query(None, description="Domain configuration to use")
):
    """
    Test cleaning patterns against sample text

    - **text**: Text to clean
    - **domain_name**: Optional domain configuration to use
    """
    try:
        from ..services.rule_engine import rule_engine

        cleaned = rule_engine._clean_description(text, domain_name)

        return {
            "original_text": text,
            "cleaned_text": cleaned,
            "domain_used": domain_name
        }
    except Exception as e:
        logger.error(f"Error testing cleaning patterns: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to test cleaning: {str(e)}")

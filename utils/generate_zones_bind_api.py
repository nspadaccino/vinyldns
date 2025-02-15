import os
import sys
import logging
from datetime import datetime
import subprocess
from typing import Optional, Tuple, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class BindDNSManager:
    def __init__(self,
                 zones_dir: str = "/etc/bind/vinyldns_zones",
                 vinyldns_zone_config: str = "/etc/bind/named.conf.vinyldns-zones",
                 zone_config: str = "/etc/bind/named.conf"):
        self.zones_dir = zones_dir
        self.vinyldns_zone_config = vinyldns_zone_config
        self.zone_config = zone_config

        try:
            os.makedirs(zones_dir, exist_ok=True)
            os.chmod(zones_dir, 0o755)
        except Exception as e:
            logger.error(f"Failed to create zones directory: {e}")
            raise

    def create_zone_file(self, zoneName: str, nameservers: List[str], ns_ipaddress: List[str],
                        admin_email: str, ttl: int = 3600, refresh: int = 604800,
                        retry: int = 86400, expire: int = 2419200,
                        negative_cache_ttl: int = 604800) -> str:
        """
        Create a zone file for BIND DNS server with multiple nameservers
        """
        try:
            if len(nameservers) != len(ns_ipaddress):
                raise ValueError("Number of nameservers must match number of IP addresses")

            admin_email = admin_email.replace('@', '.')
            serial = datetime.now().strftime("%Y%m%d01")
            zone_content = f""
            # Add NS and NS_A records for each nameserver
            for ns, ip in zip(nameservers, ns_ipaddress):
                zone_content = f"""$TTL    {ttl}
{zoneName}       IN      SOA     {ip} {admin_email}. (
                                 {serial} ; Serial
                                 {refresh} ; Refresh
                                 {retry} ; Retry
                                 {expire} ; Expire
                                 {negative_cache_ttl} ) ; Negative Cache TTL
{zoneName}    IN      NS      {ip}
"""

            zone_file_path = os.path.join(self.zones_dir, f"{zoneName}")

            with open(zone_file_path, 'w') as f:
                f.write(zone_content)

            os.chmod(zone_file_path, 0o644)
            logger.info(f"Created zone file for {zoneName} at {zone_file_path}")
            return zone_file_path

        except Exception as e:
            logger.error(f"Failed to create zone file: {e}")
            raise

    def add_zone_config(self, zoneName: str, zone_file_path: str) -> None:
        """
        Add zone configuration to BIND config file
        """
        try:
            config_content = f'''
zone "{zoneName}" {{
    type master;
    file "{zone_file_path}";
    allow-update {{ any; }};
}};
'''
            with open(self.vinyldns_zone_config, 'a') as f:
                f.write(config_content)

            named_config = 'include "/etc/bind/named.conf.vinyldns-zones";'
            with open(self.zone_config, 'r+') as f:
                content = f.read()
                if named_config not in content:
                    f.write(f"\n{named_config}\n")

            logger.info(f"Added zone configuration for {zoneName}")
        except Exception as e:
            logger.error(f"Failed to add zone configuration: {e}")
            raise

    def reload_bind(self, zoneName: str) -> Tuple[bool, Optional[str]]:
        """
        Reload BIND configuration with error handling
        """
        try:
            # Check Zone
            check_zone_result = subprocess.run(
                ['named-checkzone', f'{zoneName}', f'{self.zones_dir}/{zoneName}'],
                capture_output=True,
                text=True,
                timeout=10
            )

            if check_zone_result.returncode != 0:
                logger.error(f"Zone validation check failed: {self.zones_dir}/{zoneName} {check_zone_result.stderr}")
                return False, check_zone_result.stderr
            else:
                logger.info(f"BIND {zoneName} zone validated successfully")

                # Restart Named (Only if both zone and conf are valid)
                stop_result = subprocess.run(
                    ['service', 'named', 'stop'], # Ensure 'status' is a valid argument for 'stop'
                    capture_output=True,
                    text=True,
                    check=True  # Raises CalledProcessError on failure
                )
                print("Stop command output:", stop_result.stdout)


                # Run 'named'
                restart_result = subprocess.run(
                    ['named'], # Or the full path to the 'named' executable if it's not in your PATH
                    capture_output=True,
                    text=True,
                    check=True  # Raises CalledProcessError on failure
                )
                print("Named command output:", restart_result.stdout)

                logger.info("BIND all zones configuration reloaded successfully")
                return True, None


        except subprocess.TimeoutExpired:
            logger.error("Configuration check timed out")
            return False, "Configuration check timed out"
        except subprocess.CalledProcessError as e:
            logger.error(f"Service restart failed: {e.stderr}")
            return False, e.stderr
        except Exception as e:
            logger.error(f"Unexpected error reloading BIND: {e}")
            return False, str(e)

# FastAPI Application Setup
app = FastAPI(
    title="BIND DNS Management API",
    description="API for managing BIND DNS zones and configurations",
    version="1.0.0"
)

# Initialize DNS Manager
dns_manager = BindDNSManager()

class ZoneCreateRequest(BaseModel):
    zoneName: str
    nameservers: List[str]
    ns_ipaddress: List[str]
    admin_email: EmailStr
    ttl: Optional[int] = 3600
    refresh: Optional[int] = 604800
    retry: Optional[int] = 86400
    expire: Optional[int] = 2419200
    negative_cache_ttl: Optional[int] = 604800

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

# API Endpoints
@app.post("/api/zones/generate", response_model=APIResponse)
async def create_zone(zone_request: ZoneCreateRequest):
    logger.info(f"Creating zone with request: {zone_request}")

    try:

        zone_file = dns_manager.create_zone_file(
            zoneName=zone_request.zoneName,
            nameservers=zone_request.nameservers,
            ns_ipaddress=zone_request.ns_ipaddress,
            admin_email=str(zone_request.admin_email),
            ttl=zone_request.ttl,
            refresh=zone_request.refresh,
            retry=zone_request.retry,
            expire=zone_request.expire,
            negative_cache_ttl=zone_request.negative_cache_ttl
        )

        dns_manager.add_zone_config(zone_request.zoneName, zone_file)

        success, error = dns_manager.reload_bind(zone_request.zoneName)
        if not success:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to reload BIND: {error}"
            )

        return APIResponse(
            success=True,
            message=f"Zone {zone_request.zoneName} created successfully",
            data={
                "zoneName": zone_request.zoneName,
                "zone_file": zone_file
            }
        )

    except Exception as e:
        logger.error(f"Zone creation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/api/health", response_model=APIResponse)
async def health_check():
    return APIResponse(
        success=True,
        message="Service is running"
    )

if __name__ == "__main__":
    uvicorn.run(
        "generate_zones_bind_api:app",
        host="0.0.0.0",
        port=19000,
        reload=False
    )

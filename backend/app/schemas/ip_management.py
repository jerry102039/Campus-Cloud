"""IP 管理相關的 API Schemas"""

from datetime import datetime

from pydantic import BaseModel, field_validator
import ipaddress


class SubnetConfigCreate(BaseModel):
    """設定/更新子網配置"""

    cidr: str
    gateway: str
    bridge_name: str
    gateway_vm_ip: str
    dns_servers: str | None = None

    @field_validator("cidr")
    @classmethod
    def validate_cidr(cls, v: str) -> str:
        try:
            net = ipaddress.IPv4Network(v, strict=False)
        except (ipaddress.AddressValueError, ValueError) as e:
            raise ValueError(f"無效的 CIDR 格式: {e}") from e
        if net.prefixlen == 32:
            raise ValueError("子網遮罩不可為 /32")
        return str(net)

    @field_validator("gateway", "gateway_vm_ip")
    @classmethod
    def validate_ip(cls, v: str) -> str:
        try:
            ipaddress.IPv4Address(v)
        except (ipaddress.AddressValueError, ValueError) as e:
            raise ValueError(f"無效的 IP 位址: {e}") from e
        return v


class SubnetConfigPublic(BaseModel):
    """子網配置公開回傳格式"""

    cidr: str
    gateway: str
    bridge_name: str
    gateway_vm_ip: str
    dns_servers: str | None
    updated_at: datetime
    total_ips: int
    used_ips: int
    available_ips: int


class SubnetStatusResponse(BaseModel):
    """子網狀態摘要"""

    configured: bool
    cidr: str | None = None
    bridge_name: str | None = None
    total_ips: int = 0
    used_ips: int = 0
    available_ips: int = 0


class IpAllocationPublic(BaseModel):
    """IP 分配記錄公開格式"""

    ip_address: str
    purpose: str
    vmid: int | None
    description: str | None
    allocated_at: datetime


class IpAllocationListResponse(BaseModel):
    """IP 分配列表回傳"""

    allocations: list[IpAllocationPublic]
    total: int

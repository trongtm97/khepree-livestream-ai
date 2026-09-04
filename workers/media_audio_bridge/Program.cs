/**
 * media_audio_bridge — Windows render-endpoint helper (NAudio / WASAPI).
 * Protocol: one JSON request per stdin line → one JSON response per stdout line.
 * No business logic. MIT-licensed NAudio only.
 *
 * Build (requires .NET SDK 8+):
 *   cd workers/media_audio_bridge
 *   dotnet publish -c Release -r win-x64 --self-contained false -o bin
 * Output: bin/media_audio_bridge.exe
 */
using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using NAudio.CoreAudioApi;
using NAudio.Wave;

static class Program
{
    static readonly ConcurrentDictionary<string, PlaybackSlot> Playing = new();
    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    static int Main()
    {
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;
        string? line;
        while ((line = Console.ReadLine()) != null)
        {
            line = line.Trim();
            if (line.Length == 0) continue;
            try
            {
                var req = JsonSerializer.Deserialize<BridgeRequest>(line, JsonOpts)
                          ?? new BridgeRequest();
                var res = Handle(req);
                Write(res);
                if (string.Equals(req.Command, "quit", StringComparison.OrdinalIgnoreCase))
                    return 0;
            }
            catch (Exception ex)
            {
                Write(new BridgeResponse { Ok = false, Error = ex.Message });
            }
        }
        StopAll();
        return 0;
    }

    static BridgeResponse Handle(BridgeRequest req)
    {
        var cmd = (req.Command ?? "").Trim().ToLowerInvariant();
        return cmd switch
        {
            "list_devices" => ListDevices(req),
            "play" => Play(req),
            "stop" => Stop(req),
            "health" => Health(req),
            "quit" => Quit(req),
            _ => new BridgeResponse { Id = req.Id, Ok = false, Error = "UNKNOWN_COMMAND" }
        };
    }

    static BridgeResponse ListDevices(BridgeRequest req)
    {
        using var enumerator = new MMDeviceEnumerator();
        var devices = new List<DeviceDto>();
        string? defaultId = null;
        try
        {
            defaultId = enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia).ID;
        }
        catch { /* no default */ }

        foreach (var d in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.All))
        {
            using (d)
            {
                devices.Add(new DeviceDto
                {
                    Id = d.ID,
                    Name = d.FriendlyName,
                    State = MapState(d.State),
                    IsDefault = defaultId != null && d.ID == defaultId
                });
            }
        }

        return new BridgeResponse { Id = req.Id, Ok = true, Devices = devices };
    }

    static BridgeResponse Play(BridgeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.DeviceId))
            return new BridgeResponse { Id = req.Id, Ok = false, Error = "DEVICE_ID_REQUIRED" };
        if (string.IsNullOrWhiteSpace(req.FilePath) || !File.Exists(req.FilePath))
            return new BridgeResponse { Id = req.Id, Ok = false, Error = "FILE_NOT_FOUND" };

        MMDevice? device;
        try
        {
            using var enumerator = new MMDeviceEnumerator();
            device = enumerator.GetDevice(req.DeviceId);
            if (device.State != DeviceState.Active)
            {
                device.Dispose();
                return new BridgeResponse
                {
                    Id = req.Id,
                    Ok = false,
                    Error = "DEVICE_NOT_ACTIVE",
                    DevicePresent = false,
                    Status = "DOWN"
                };
            }
        }
        catch
        {
            return new BridgeResponse
            {
                Id = req.Id,
                Ok = false,
                Error = "DEVICE_GONE",
                DevicePresent = false,
                Status = "DOWN"
            };
        }

        // Stop prior playback on this endpoint only — never touch other devices.
        StopDevice(req.DeviceId);

        try
        {
            var reader = new AudioFileReader(req.FilePath!);
            var output = new WasapiOut(device, AudioClientShareMode.Shared, false, 200);
            output.Init(reader);
            var slot = new PlaybackSlot(req.DeviceId!, output, reader, device);
            Playing[req.DeviceId!] = slot;

            var done = new ManualResetEventSlim(false);
            Exception? playErr = null;
            output.PlaybackStopped += (_, e) =>
            {
                if (e.Exception != null) playErr = e.Exception;
                done.Set();
            };
            output.Play();
            done.Wait();
            slot.Dispose();
            Playing.TryRemove(req.DeviceId!, out _);

            if (playErr != null)
                return new BridgeResponse { Id = req.Id, Ok = false, Error = playErr.Message };
            return new BridgeResponse { Id = req.Id, Ok = true };
        }
        catch (Exception ex)
        {
            device.Dispose();
            return new BridgeResponse { Id = req.Id, Ok = false, Error = ex.Message };
        }
    }

    static BridgeResponse Stop(BridgeRequest req)
    {
        if (!string.IsNullOrWhiteSpace(req.DeviceId))
            StopDevice(req.DeviceId!);
        else
            StopAll();
        return new BridgeResponse { Id = req.Id, Ok = true };
    }

    static BridgeResponse Health(BridgeRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.DeviceId))
            return new BridgeResponse { Id = req.Id, Ok = false, Error = "DEVICE_ID_REQUIRED" };

        try
        {
            using var enumerator = new MMDeviceEnumerator();
            using var device = enumerator.GetDevice(req.DeviceId);
            var active = device.State == DeviceState.Active;
            return new BridgeResponse
            {
                Id = req.Id,
                Ok = true,
                DevicePresent = active,
                Status = active ? "OK" : "DOWN",
                Message = active ? device.FriendlyName : $"Endpoint state={device.State}"
            };
        }
        catch
        {
            return new BridgeResponse
            {
                Id = req.Id,
                Ok = true,
                DevicePresent = false,
                Status = "DOWN",
                Message = "Endpoint disconnected or uninstalled"
            };
        }
    }

    static BridgeResponse Quit(BridgeRequest req)
    {
        StopAll();
        return new BridgeResponse { Id = req.Id, Ok = true };
    }

    static void StopDevice(string deviceId)
    {
        if (Playing.TryRemove(deviceId, out var slot))
            slot.Stop();
    }

    static void StopAll()
    {
        foreach (var key in Playing.Keys.ToArray())
            StopDevice(key);
    }

    static string MapState(DeviceState state) => state switch
    {
        DeviceState.Active => "ACTIVE",
        DeviceState.Disabled => "DISABLED",
        DeviceState.Unplugged => "UNPLUGGED",
        DeviceState.NotPresent => "NOTPRESENT",
        _ => "UNKNOWN"
    };

    static void Write(BridgeResponse res)
    {
        Console.WriteLine(JsonSerializer.Serialize(res, JsonOpts));
        Console.Out.Flush();
    }
}

sealed class PlaybackSlot : IDisposable
{
    private readonly WasapiOut _out;
    private readonly AudioFileReader _reader;
    private readonly MMDevice _device;

    public PlaybackSlot(string deviceId, WasapiOut output, AudioFileReader reader, MMDevice device)
    {
        DeviceId = deviceId;
        _out = output;
        _reader = reader;
        _device = device;
    }

    public string DeviceId { get; }

    public void Stop()
    {
        try { _out.Stop(); } catch { /* ignore */ }
    }

    public void Dispose()
    {
        try { _out.Dispose(); } catch { /* ignore */ }
        try { _reader.Dispose(); } catch { /* ignore */ }
        try { _device.Dispose(); } catch { /* ignore */ }
    }
}

sealed class BridgeRequest
{
    public string? Id { get; set; }
    public string? Command { get; set; }
    public string? DeviceId { get; set; }
    public string? FilePath { get; set; }
}

sealed class BridgeResponse
{
    public string? Id { get; set; }
    public bool Ok { get; set; }
    public string? Error { get; set; }
    public List<DeviceDto>? Devices { get; set; }
    public string? Status { get; set; }
    public string? Message { get; set; }
    public bool? DevicePresent { get; set; }
}

sealed class DeviceDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string State { get; set; } = "UNKNOWN";
    public bool IsDefault { get; set; }
}
